import type { Router as ExpressRouter } from "express";
import { Router } from "express";
import { getHealth } from "../controllers/health.controller";

export const healthRouter: ExpressRouter = Router();
healthRouter.get("/", getHealth);
