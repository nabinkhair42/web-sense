import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { createError } from "../../domain/errors";
import { SearchResult } from "../../domain/models";

export interface SearchAdapter {
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

export class GoogleCseAdapter implements SearchAdapter {
  private readonly baseUrl = "https://www.googleapis.com/customsearch/v1";
  private readonly apiKey = env.GOOGLE_CSE_API_KEY;
  private readonly cx = env.GOOGLE_CSE_CX;

  async search(
    query: string,
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    logger.info({ query, maxResults }, "Searching with Google CSE");

    try {
      const results: SearchResult[] = [];
      let startIndex = 1;
      const maxQueries = Math.ceil(maxResults / 10); // Google CSE returns max 10 per query

      for (let i = 0; i < maxQueries && results.length < maxResults; i++) {
        const url = new URL(this.baseUrl);
        url.searchParams.set("key", this.apiKey);
        url.searchParams.set("cx", this.cx);
        url.searchParams.set("q", query);
        url.searchParams.set("start", startIndex.toString());
        url.searchParams.set(
          "num",
          Math.min(10, maxResults - results.length).toString()
        );

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(
            { status: response.status, error: errorText },
            "Google CSE API error"
          );

          if (response.status === 429) {
            throw createError(
              "RATE_LIMITED",
              "Google CSE rate limit exceeded",
              429
            );
          }

          throw createError(
            "SEARCH_FAILED",
            `Google CSE API error: ${response.status}`,
            500
          );
        }

        const data = await response.json();

        if (data.error) {
          logger.error({ error: data.error }, "Google CSE API returned error");
          throw createError(
            "SEARCH_FAILED",
            `Google CSE error: ${data.error.message}`,
            500
          );
        }

        if (data.items && Array.isArray(data.items)) {
          const searchResults = data.items.map((item: any) => ({
            title: item.title || "No title",
            url: item.link || "",
            snippet: item.snippet || item.htmlSnippet || "No snippet",
          }));

          results.push(...searchResults);
        }

        // Check if there are more results
        if (!data.queries?.nextPage) {
          break;
        }

        startIndex += 10;

        // Small delay to be respectful to the API
        if (i < maxQueries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info(
        { resultCount: results.length },
        "Google CSE search completed"
      );
      return results.slice(0, maxResults);
    } catch (error) {
      if (error instanceof Error && error.message.includes("rate limit")) {
        throw error;
      }

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Google CSE search failed"
      );
      throw createError(
        "SEARCH_FAILED",
        "Failed to search with Google CSE",
        500
      );
    }
  }
}

export const googleCseAdapter = new GoogleCseAdapter();
