import express, { type Request, type Response } from "express";

export function createApp() {
  const app = express();

  app.get("/api/health", (_request: Request, response: Response) => {
    response.json({ status: "ok" });
  });

  return app;
}
