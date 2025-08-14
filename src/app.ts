import express, { Express, NextFunction } from "express";
import cors from "cors";
import { json } from "body-parser";
import { answerRouter } from "./routes/answer.route";
import { healthRouter } from "./routes/health.route";
import { errorMiddleware } from "./middleware/error.middleware";
import { logger } from "./config/logger";

export const app = express() as Express;

// Middleware
app.use(
  cors({
    origin: [/localhost/, /127\.0\.0\.1/],
    methods: ["POST", "GET"],
  })
);
app.use(json({ limit: "1mb" }));

// Request logging
app.use((req, _res, next: NextFunction) => {
  logger.info({
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Routes
app.use("/v1/answer", answerRouter);
app.use("/v1/health", healthRouter);

// Error handling
app.use(errorMiddleware);

// 404 handler
app.use("*", (_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found",
    },
  });
});
