import { env } from "../config/env";
import { logger } from "../config/logger";
import { HealthResponse } from "../domain/models";

export class HealthService {
  async check(): Promise<HealthResponse> {
    logger.debug("Performing health check");

    const checks = {
      googleCse: await this.checkGoogleCse(),
      lmStudio: await this.checkLmStudio(),
    };

    const status = Object.values(checks).every(Boolean)
      ? "healthy"
      : "unhealthy";

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkGoogleCse(): Promise<boolean> {
    try {
      // Simple validation of API key format (Google API keys are typically 39 characters)
      const apiKey = env.GOOGLE_CSE_API_KEY;
      const cx = env.GOOGLE_CSE_CX;

      if (!apiKey || apiKey.length < 30 || !cx || cx.length < 10) {
        logger.warn("Google CSE configuration appears invalid");
        return false;
      }

      // Test with a simple search query
      const testUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=test&num=1`;
      const response = await fetch(testUrl, { method: "GET" });

      if (response.ok) {
        const data = await response.json();
        // Check if we get a valid response (even if no results)
        return !data.error || data.error.code !== 400;
      }

      return false;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "Google CSE health check failed"
      );
      return false;
    }
  }

  private async checkLmStudio(): Promise<boolean> {
    try {
      const baseUrl = env.LMSTUDIO_BASE_URL;
      const model = env.LMSTUDIO_MODEL;

      if (!baseUrl || !model) {
        logger.warn("LM Studio configuration appears invalid");
        return false;
      }

      // Test connectivity with a simple health check
      const response = await fetch(`${baseUrl}/models`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Check if we get a valid response
        return Array.isArray(data.data) || data.object === "list";
      }

      return false;
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        "LM Studio health check failed"
      );
      return false;
    }
  }
}

export const healthService = new HealthService();
