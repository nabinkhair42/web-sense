import { NextFunction, Request, Response } from "express";
import { healthService } from "../services/health.service";

export async function getHealth(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const health = await healthService.check();
    res.json(health);
  } catch (err) {
    next(err);
  }
}
