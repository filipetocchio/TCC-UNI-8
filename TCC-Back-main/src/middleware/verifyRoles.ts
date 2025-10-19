// Todos direitos autorais reservados pelo QOTA.

/**
 * Middleware de Verificação de Papéis (RBAC)
 *
 * Descrição:
 * Este arquivo contém uma "fábrica de middlewares" para controle de acesso
 * baseado em papéis (Role-Based Access Control - RBAC).
 *
 * A função `verifyRoles` não é um middleware em si, mas uma função que gera e
 * retorna um middleware do Express. Isso permite criar "guardas" de rota
 * customizáveis, especificando quais papéis (roles) são necessários para acessar
 * um determinado endpoint.
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Gera um middleware para verificar se o usuário autenticado possui pelo menos
 * um dos papéis (roles) necessários para acessar uma rota.
 *
 * @example
 * // Em um arquivo de rotas, para permitir acesso apenas a Admins:
 * router.get('/admin', protect, verifyRoles(ROLES_LIST.Admin), getAdminData);
 *
 * // Para permitir acesso a Admins e Editores:
 * router.post('/edit', protect, verifyRoles(ROLES_LIST.Admin, ROLES_LIST.Editor), editPost);
 *
 * @param allowedRoles Uma lista de códigos numéricos representando os papéis que têm permissão de acesso.
 * @returns A função de middleware do Express.
 */
export const verifyRoles = (...allowedRoles: number[]) => {
  // A função retornada é o middleware que será executado pelo Express.
  return (req: Request, res: Response, next: NextFunction) => {
    // NOTA TÉCNICA: A propriedade `req.roles` é adicionada ao objeto Request por um
    // middleware anterior (ex: 'protect'), que decodifica o token do usuário.
    // É necessário estender a interface Request do Express para o TypeScript
    // reconhecer esta propriedade sem erros.

    // --- 1. Verificação da Presença dos Papéis (Roles) ---
    // Garante que as informações de papéis do usuário foram carregadas corretamente.
    if (!req?.roles) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. As informações de permissão do usuário não foram encontradas.',
      });
    }

    // --- 2. Lógica de Autorização ---
    // Verifica se pelo menos um dos papéis do usuário (`req.roles`) está
    // presente na lista de papéis permitidos para esta rota (`allowedRoles`).
    const hasRequiredRole = req.roles.some((role) =>
      allowedRoles.includes(role)
    );

    if (!hasRequiredRole) {
      // Se o usuário não possui nenhum dos papéis necessários, retorna um erro 403 (Forbidden).
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não tem permissão para executar esta ação.',
      });
    }

    // --- 3. Concessão de Acesso ---
    // Se a verificação for bem-sucedida, passa o controle para o próximo handler.
    next();
  };
};