import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
require("dotenv").config();

interface JwtPayload {
  UserInfo: {
    username: string;
    roles: number[];
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: string;
      roles?: number[];
    }
  }
}

const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token de autorização ausente ou inválido" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido ou expirado" });
    }
    const payload = decoded as JwtPayload;
    req.user = payload.UserInfo.username;
    req.roles = payload.UserInfo.roles;
    next();
  });
};

export { verifyJWT };
