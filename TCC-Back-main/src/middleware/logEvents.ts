// Todos direitos autorais reservados pelo QOTA.


import { format } from "date-fns";
import { Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";

const logEvents = async (message: string, logName: string) => {
  const dateTime = `${format(new Date(), "yyyyMMdd\tHH:mm:ss")}`;
  const logItem = `${dateTime}\t${uuid()}\t${message}\n`;
  const logsDir = process.env.LOGS_DIR || path.join(__dirname, "..", "logs");

  try {
    if (!fs.existsSync(logsDir)) {
      await fsPromises.mkdir(logsDir, { recursive: true });
    }
    await fsPromises.appendFile(path.join(logsDir, logName), logItem);
  } catch (err) {
    console.error("Erro ao gravar log:", err);
  }
};

const logger = (req: Request, res: Response, next: NextFunction) => {
  logEvents(`${req.method}\t${req.headers.origin || "unknown"}\t${req.url}`, "reqLog.txt");
  next();
};

export { logEvents, logger };