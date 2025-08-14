import { env } from "../config/env";
import { logger } from "../config/logger";
import { ExtractedDoc } from "../domain/models";

export interface IBudgetService {
  budgetDocuments(docs: ExtractedDoc[]): ExtractedDoc[];
}

export class BudgetService implements IBudgetService {
  // Conservative token estimation: roughly 4 characters per token
  private readonly charsPerToken = 4;
  // Reserve some tokens for the system prompt and user query
  private readonly reservedTokens = 500;
  // Target 80% of max context to be safe
  private readonly safetyMargin = 0.8;

  budgetDocuments(docs: ExtractedDoc[]): ExtractedDoc[] {
    logger.info(
      {
        docCount: docs.length,
        totalChars: docs.reduce((sum, doc) => sum + doc.charCount, 0),
        perDocBudget: env.PER_DOC_CHAR_BUDGET,
        totalBudget: env.TOTAL_CONTEXT_CHAR_BUDGET,
      },
      "Budgeting documents"
    );

    if (docs.length === 0) {
      return [];
    }

    // Calculate safe token limits
    const maxTokens = Math.floor(
      (env.TOTAL_CONTEXT_CHAR_BUDGET / this.charsPerToken) * this.safetyMargin
    );
    const availableTokens = maxTokens - this.reservedTokens;
    const perDocMaxTokens = Math.floor(
      (env.PER_DOC_CHAR_BUDGET / this.charsPerToken) * this.safetyMargin
    );

    logger.info(
      {
        maxTokens,
        availableTokens,
        perDocMaxTokens,
        reservedTokens: this.reservedTokens,
      },
      "Token budgeting parameters"
    );

    // First, apply per-document budget
    const budgetedDocs = docs.map(doc => ({
      ...doc,
      content: this.truncateContent(
        doc.content,
        perDocMaxTokens * this.charsPerToken
      ),
      charCount: Math.min(doc.charCount, perDocMaxTokens * this.charsPerToken),
    }));

    // Sort by relevance score (simple heuristic: longer content = more relevant)
    const sortedDocs = budgetedDocs.sort((a, b) => b.charCount - a.charCount);

    // Apply total context budget with token awareness
    let totalTokens = 0;
    const finalDocs: ExtractedDoc[] = [];

    for (const doc of sortedDocs) {
      const docTokens = Math.ceil(doc.charCount / this.charsPerToken);

      if (totalTokens + docTokens <= availableTokens) {
        finalDocs.push(doc);
        totalTokens += docTokens;
      } else {
        // Try to fit a truncated version if it's the first document
        if (finalDocs.length === 0 && docTokens > 100) {
          const remainingTokens = availableTokens;
          const remainingChars = remainingTokens * this.charsPerToken;
          const truncatedContent = this.truncateContent(
            doc.content,
            remainingChars
          );
          finalDocs.push({
            ...doc,
            content: truncatedContent,
            charCount: truncatedContent.length,
          });
        }
        break;
      }
    }

    const finalTotalChars = finalDocs.reduce(
      (sum, doc) => sum + doc.charCount,
      0
    );
    const finalTotalTokens = Math.ceil(finalTotalChars / this.charsPerToken);

    logger.info(
      {
        originalCount: docs.length,
        finalCount: finalDocs.length,
        finalTotalChars,
        finalTotalTokens,
        budgetUtilization: `${(
          (finalTotalChars / env.TOTAL_CONTEXT_CHAR_BUDGET) *
          100
        ).toFixed(1)}%`,
        tokenUtilization: `${((finalTotalTokens / maxTokens) * 100).toFixed(
          1
        )}%`,
      },
      "Document budgeting completed"
    );

    return finalDocs;
  }

  private truncateContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }

    // Try to truncate at sentence boundaries
    const truncated = content.substring(0, maxChars);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf("! "),
      truncated.lastIndexOf("? "),
      truncated.lastIndexOf("\n\n")
    );

    if (lastSentenceEnd > maxChars * 0.8) {
      // If we can find a good sentence boundary, use it
      return truncated.substring(0, lastSentenceEnd + 1).trim();
    }

    // Otherwise, truncate at word boundary
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxChars * 0.9) {
      return truncated.substring(0, lastSpace).trim();
    }

    // Fallback to exact truncation
    return truncated.trim();
  }
}

export const budgetService = new BudgetService();
