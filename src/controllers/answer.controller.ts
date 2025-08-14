import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { createError } from "../domain/errors";
import { agentService } from "../services/agent.service";
import { AnswerRequest } from "../domain/models";

const BodySchema = z.object({
  query: z.string().min(3).max(1000),
  maxLinks: z.number().int().min(1).max(10).optional(),
  siteFilter: z.array(z.string().url()).optional(),
});

export async function postAnswer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = BodySchema.parse(req.body);
    const result = await agentService.answer(body as AnswerRequest);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(
        createError("INVALID_REQUEST", "Invalid request body", 400, {
          validationErrors: err.errors,
        })
      );
      return;
    }
    next(err);
  }
}
