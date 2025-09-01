/**
 * @file verifyRoles.ts
 * @description Middleware para controle de acesso baseado em papéis (Role-Based Access Control - RBAC).
 * Permite que rotas sejam protegidas, exigindo que o usuário tenha um dos papéis permitidos.
 */
import { Request, Response, NextFunction } from "express";
// Importar sua lista de papéis (roles) de um local centralizado é uma boa prática.
// Ex: import { ROLES_LIST } from "../config/rolesList";

/**
 * @function verifyRoles
 * @description Factory function que gera um middleware para verificar se o usuário
 * autenticado possui pelo menos um dos papéis (roles) necessários para acessar uma rota.
 * @param {...number[]} allowedRoles - Uma lista de IDs de papéis que têm permissão de acesso.
 * @returns {Function} Retorna a função de middleware do Express.
 */
const verifyRoles = (...allowedRoles: number[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Verificação Preliminar: Garante que a propriedade 'roles' existe na requisição.
    // Ela deve ter sido populada por um middleware de autenticação anterior (como o 'protect').
    if (!req?.roles) {
      return res.status(401).json({ message: "Acesso não autorizado, informações de papel ausentes." });
    }

    // 2. Lógica de Autorização
    // Verifica se algum dos papéis do usuário (`req.roles`) está presente na lista de papéis permitidos.
    const hasRequiredRole = req.roles.some((role) => allowedRoles.includes(role));
    
    if (!hasRequiredRole) {
      // Se o usuário não possui nenhum dos papéis necessários, retorna um erro 403 (Forbidden).
      return res.status(403).json({ message: "Permissão insuficiente para executar esta ação." });
    }
    
    // 3. Sucesso
    // Se a verificação for bem-sucedida, passa o controle para o próximo middleware ou controller na pilha.
    next();
  };
};

export { verifyRoles };
