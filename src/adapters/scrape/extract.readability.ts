import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { logger } from "../../config/logger";
import { createError } from "../../domain/errors";
import { ExtractedDoc } from "../../domain/models";

export interface ContentExtractor {
  extract(html: string, url: string): Promise<ExtractedDoc>;
}

export class ReadabilityExtractor implements ContentExtractor {
  async extract(html: string, url: string): Promise<ExtractedDoc> {
    logger.info(
      { url, htmlLength: html.length },
      "Extracting content with Readability"
    );

    try {
      // Parse HTML with jsdom
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      // Use Readability to extract clean content
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        logger.warn(
          { url },
          "Readability failed to extract content, falling back to basic extraction"
        );
        return this.fallbackExtraction(document, url);
      }

      // Clean and normalize the extracted content
      const title = this.cleanText(article.title || "No title");
      const content = this.cleanText(
        article.textContent || article.content || ""
      );
      const charCount = content.length;

      if (charCount === 0) {
        logger.warn({ url }, "Extracted content is empty, using fallback");
        return this.fallbackExtraction(document, url);
      }

      logger.info(
        { url, title, charCount },
        "Content extracted successfully with Readability"
      );

      return {
        title,
        url,
        content,
        charCount,
      };
    } catch (error) {
      logger.error(
        { url, error: error instanceof Error ? error.message : String(error) },
        "Readability extraction failed"
      );

      try {
        // Fallback to basic extraction
        const dom = new JSDOM(html, { url });
        return this.fallbackExtraction(dom.window.document, url);
      } catch (fallbackError) {
        logger.error(
          {
            url,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
          },
          "Fallback extraction also failed"
        );
        throw createError(
          "SCRAPING_FAILED",
          "Failed to extract content from HTML",
          500
        );
      }
    }
  }

  private fallbackExtraction(document: any, url: string): ExtractedDoc {
    // Basic fallback: extract title and body text
    const title = this.cleanText(document.title || "No title");

    // Try to get content from common content areas
    const contentSelectors = [
      "main",
      "article",
      ".content",
      ".post-content",
      ".entry-content",
      "#content",
      "#main-content",
      "body",
    ];

    let content = "";
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        content = this.cleanText(element.textContent || "");
        if (content.length > 100) break; // Found substantial content
      }
    }

    if (content.length === 0) {
      content = this.cleanText(
        document.body?.textContent || "No content available"
      );
    }

    const charCount = content.length;
    logger.info(
      { url, title, charCount, method: "fallback" },
      "Content extracted using fallback method"
    );

    return {
      title,
      url,
      content,
      charCount,
    };
  }

  private cleanText(text: string): string {
    if (!text) return "";

    return text
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n+/g, "\n") // Normalize line breaks
      .replace(/\t+/g, " ") // Replace tabs with spaces
      .trim();
  }
}

export const readabilityExtractor = new ReadabilityExtractor();
