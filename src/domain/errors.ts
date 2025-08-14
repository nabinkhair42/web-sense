export class AppError extends Error {
  constructor(
    public code: string,
    public override message: string,
    public httpStatus: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  SEARCH_FAILED: "SEARCH_FAILED",
  SCRAPING_FAILED: "SCRAPING_FAILED",
  LLM_FAILED: "LLM_FAILED",
  TIMEOUT: "TIMEOUT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export const createError = (
  code: keyof typeof ErrorCodes,
  message: string,
  httpStatus?: number,
  details?: Record<string, unknown>
) => {
  return new AppError(ErrorCodes[code], message, httpStatus, details);
};
