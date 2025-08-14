import { Request, Response } from "express";
import { logger } from "../config/logger";
import { AppError } from "../domain/errors";

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response
): void {
  logger.error({ error: error.message, stack: error.stack, url: req.url });

  if (error instanceof AppError) {
    res.status(error.httpStatus).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
