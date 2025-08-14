import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { createError } from "../../domain/errors";

export interface LLMClient {
  generateAnswer(context: string, query: string): Promise<string>;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

export class LMStudioClient implements LLMClient {
  private readonly baseUrl = env.LMSTUDIO_BASE_URL;
  private readonly model = env.LMSTUDIO_MODEL;
  private readonly apiKey = env.LMSTUDIO_API_KEY;

  async generateAnswer(context: string, query: string): Promise<string> {
    logger.info(
      { contextLength: context.length, query },
      "Generating answer with LM Studio"
    );

    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(context, query);

      // Log token estimates for debugging
      const estimatedTokens = this.estimateTokens(
        systemPrompt + userPrompt + context
      );
      logger.info(
        { estimatedTokens, contextLength: context.length },
        "Token estimation"
      );

      const requestBody: ChatCompletionRequest = {
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1, // Low temperature for consistent, factual responses
        max_tokens: 2000,
        stream: false,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText },
          "LM Studio API error"
        );

        // Handle context length errors specifically
        if (response.status === 400 && errorText.includes("context length")) {
          throw createError(
            "LLM_FAILED",
            "Context too long for this model. Try reducing the number of sources or content length.",
            400
          );
        }

        throw createError(
          "LLM_FAILED",
          `LM Studio API error: ${response.status}`,
          500
        );
      }

      const data: ChatCompletionResponse = await response.json();

      if (data.error) {
        logger.error({ error: data.error }, "LM Studio returned error");
        throw createError(
          "LLM_FAILED",
          `LM Studio error: ${data.error.message}`,
          500
        );
      }

      if (!data.choices || data.choices.length === 0) {
        throw createError("LLM_FAILED", "No response from LM Studio", 500);
      }

      const answer = data.choices[0].message.content.trim();

      if (!answer) {
        throw createError("LLM_FAILED", "Empty response from LM Studio", 500);
      }

      logger.info(
        { answerLength: answer.length },
        "Answer generated successfully"
      );
      return answer;
    } catch (error) {
      if (error instanceof Error && error.message.includes("LLM_FAILED")) {
        throw error;
      }

      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "LM Studio request failed"
      );
      throw createError(
        "LLM_FAILED",
        "Failed to generate answer with LM Studio",
        500
      );
    }
  }

  private buildSystemPrompt(): string {
    return `You are WebSense, an AI assistant that answers questions based on provided web content sources.

IMPORTANT RULES:
1. ONLY use information from the provided sources to answer questions
2. If the sources don't contain enough information to answer the question, say so clearly
3. Always cite your sources using [1], [2], [3] format
4. Be factual, concise, and helpful
5. Do not make up information or use external knowledge
6. If asked about something not covered in the sources, politely decline to answer

Format your response as a clear, well-structured answer with proper citations.`;
  }

  private buildUserPrompt(context: string, query: string): string {
    return `Based on the following web content sources, please answer this question: "${query}"

SOURCES:
${context}

Please provide a comprehensive answer using only the information from these sources. Include citations [1], [2], [3] etc. for each piece of information you use.`;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 4 characters per token (conservative)
    return Math.ceil(text.length / 4);
  }
}

export const lmStudioClient = new LMStudioClient();
