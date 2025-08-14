import { fetch } from "undici";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { createError } from "../../domain/errors";

export interface FetchClient {
  fetch(url: string, timeout?: number): Promise<string>;
}

export class UndiciFetchClient implements FetchClient {
  async fetch(
    url: string,
    timeout: number = env.REQUEST_TIMEOUT_MS
  ): Promise<string> {
    logger.info({ url, timeout }, "Fetching content");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "WebSense/1.0 (Educational Project)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn({ url, status: response.status }, "HTTP request failed");
        throw createError(
          "SCRAPING_FAILED",
          `HTTP ${response.status}: ${response.statusText}`,
          400
        );
      }

      const contentType = response.headers.get("content-type") || "";

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        logger.warn({ url, contentType }, "Non-HTML content type, skipping");
        throw createError(
          "SCRAPING_FAILED",
          "Non-HTML content not supported",
          400
        );
      }

      const content = await response.text();

      if (!content || content.length === 0) {
        throw createError("SCRAPING_FAILED", "Empty response content", 400);
      }

      logger.info(
        { url, contentLength: content.length },
        "Content fetched successfully"
      );
      return content;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          logger.warn({ url, timeout }, "Request timed out");
          throw createError(
            "TIMEOUT",
            `Request timed out after ${timeout}ms`,
            408
          );
        }

        if (error.message.includes("SCRAPING_FAILED")) {
          throw error;
        }
      }

      logger.error(
        { url, error: error instanceof Error ? error.message : String(error) },
        "Fetch failed"
      );
      throw createError("SCRAPING_FAILED", "Failed to fetch content", 500);
    }
  }
}

export const undiciFetchClient = new UndiciFetchClient();
