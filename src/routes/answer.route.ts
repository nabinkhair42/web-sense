import { Router, Router as ExpressRouter } from "express";
import { postAnswer } from "../controllers/answer.controller";
export const answerRouter: ExpressRouter = Router();
answerRouter.post("/", postAnswer);
