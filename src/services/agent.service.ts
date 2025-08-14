import pLimit from "p-limit";
import { lmStudioClient } from "../adapters/llm/lmstudio.client";
import { readabilityExtractor } from "../adapters/scrape/extract.readability";
import { undiciFetchClient } from "../adapters/scrape/fetch.client";
import { googleCseAdapter } from "../adapters/search/googleCse.adapter";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { createError } from "../domain/errors";
import {
  AnswerRequest,
  AnswerResponse,
  ExtractedDoc,
  SearchResult,
} from "../domain/models";
import { createTimer } from "../utils/timing";
import { deduplicateUrls } from "../utils/url";
import { budgetService } from "./budget.service";

export class AgentService {
  async answer(request: AnswerRequest): Promise<AnswerResponse> {
    const timer = createTimer();
    logger.info(
      { query: request.query, maxLinks: request.maxLinks },
      "Processing answer request"
    );

    try {
      // Step 1: Search for relevant content
      const maxLinks = request.maxLinks || 5;
      const searchResults = await this.searchContent(request.query, maxLinks);

      if (searchResults.length === 0) {
        throw createError("SEARCH_FAILED", "No search results found", 404);
      }

      // Step 2: Scrape and extract content
      const extractedDocs = await this.scrapeContent(
        searchResults,
        request.siteFilter
      );

      if (extractedDocs.length === 0) {
        throw createError(
          "SCRAPING_FAILED",
          "Failed to extract content from any sources",
          500
        );
      }

      // Step 3: Budget and prepare context
      const budgetedDocs = budgetService.budgetDocuments(extractedDocs);

      if (budgetedDocs.length === 0) {
        throw createError(
          "SCRAPING_FAILED",
          "No content available after budgeting",
          500
        );
      }

      // Step 4: Generate answer using LLM
      const context = this.buildContext(budgetedDocs);
      const answer = await lmStudioClient.generateAnswer(
        context,
        request.query
      );

      // Step 5: Prepare response
      const tookMs = timer();
      const sources = budgetedDocs.map(doc => ({
        title: doc.title,
        url: doc.url,
      }));

      logger.info(
        {
          query: request.query,
          searchResults: searchResults.length,
          extractedDocs: extractedDocs.length,
          budgetedDocs: budgetedDocs.length,
          tookMs,
        },
        "Answer request completed successfully"
      );

      return {
        answer,
        sources,
        meta: {
          tookMs,
          partial: extractedDocs.length < searchResults.length,
        },
      };
    } catch (error) {
      const tookMs = timer();
      logger.error(
        {
          query: request.query,
          error: error instanceof Error ? error.message : String(error),
          tookMs,
        },
        "Answer request failed"
      );

      if (error instanceof Error && error.message.includes("SEARCH_FAILED")) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("SCRAPING_FAILED")) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("LLM_FAILED")) {
        throw error;
      }

      throw createError(
        "INTERNAL_ERROR",
        "Failed to process answer request",
        500
      );
    }
  }

  private async searchContent(
    query: string,
    maxResults: number
  ): Promise<SearchResult[]> {
    logger.info({ query, maxResults }, "Starting content search");

    try {
      const results = await googleCseAdapter.search(query, maxResults);
      logger.info({ query, resultCount: results.length }, "Search completed");
      return results;
    } catch (error) {
      logger.error(
        {
          query,
          error: error instanceof Error ? error.message : String(error),
        },
        "Search failed"
      );
      throw error;
    }
  }

  private async scrapeContent(
    searchResults: SearchResult[],
    siteFilter?: string[]
  ): Promise<ExtractedDoc[]> {
    logger.info(
      { resultCount: searchResults.length, siteFilter },
      "Starting content scraping"
    );

    // Filter URLs if site filter is provided
    let urlsToScrape = searchResults.map(result => result.url);
    if (siteFilter && siteFilter.length > 0) {
      urlsToScrape = urlsToScrape.filter(url =>
        siteFilter.some(site => url.includes(site))
      );
      logger.info(
        {
          originalCount: searchResults.length,
          filteredCount: urlsToScrape.length,
        },
        "URLs filtered by site"
      );
    }

    // Deduplicate URLs
    const uniqueUrls = deduplicateUrls(urlsToScrape);
    logger.info({ uniqueUrls: uniqueUrls.length }, "URLs deduplicated");

    // Scrape content with concurrency control
    const limit = pLimit(env.CONCURRENT_FETCHES);
    const scrapePromises = uniqueUrls.map(url =>
      limit(() => this.scrapeSingleUrl(url))
    );

    const results = await Promise.allSettled(scrapePromises);

    // Process results and filter out failures
    const extractedDocs: ExtractedDoc[] = [];
    const failures: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        extractedDocs.push(result.value);
      } else {
        const url = uniqueUrls[index];
        const error =
          result.status === "rejected" ? result.reason : "Unknown error";
        logger.warn(
          {
            url,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to scrape URL"
        );
        failures.push(url);
      }
    });

    logger.info(
      {
        totalUrls: uniqueUrls.length,
        successful: extractedDocs.length,
        failed: failures.length,
      },
      "Content scraping completed"
    );

    return extractedDocs;
  }

  private async scrapeSingleUrl(url: string): Promise<ExtractedDoc | null> {
    try {
      const html = await undiciFetchClient.fetch(url);
      const extractedDoc = await readabilityExtractor.extract(html, url);
      return extractedDoc;
    } catch (error) {
      logger.warn(
        { url, error: error instanceof Error ? error.message : String(error) },
        "Failed to scrape single URL"
      );
      return null;
    }
  }

  private buildContext(docs: ExtractedDoc[]): string {
    const contextParts = docs.map((doc, index) => {
      return `[${index + 1}] ${doc.title}\nURL: ${doc.url}\n\n${
        doc.content
      }\n\n---\n`;
    });

    return contextParts.join("\n");
  }
}

export const agentService = new AgentService();
