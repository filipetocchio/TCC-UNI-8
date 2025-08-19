import { Request, Response, NextFunction } from "express";
import { logEvents } from "./logEvents";

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  logEvents(`${err.name}: ${message}`, "errLog.txt");
  res.status(status).json({ error: message });
};

export { errorHandler };