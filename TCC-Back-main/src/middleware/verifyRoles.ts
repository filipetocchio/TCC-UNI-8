import { Request, Response, NextFunction } from "express";
import { Role, ROLES_LIST } from "../config/rolesList";

const verifyRoles = (...allowedRoles: number[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req?.roles) {
      return res.status(401).json({ message: "Nenhum papel encontrado na requisição" });
    }

    const hasRole = req.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ message: "Permissão insuficiente para esta ação" });
    }
    next();
  };
};

export { verifyRoles };