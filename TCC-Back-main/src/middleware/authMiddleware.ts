/**
 * @file authMiddleware.ts
 * @description Middleware para proteger rotas, verificando a validade de tokens JWT.
 */
// Todos direitos autorais reservados pelo QOTA.

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Define a estrutura do payload que esperamos encontrar dentro do token decodificado
interface JwtPayload {
  userId: number;
  email: string;
}

/**
 * @function protect
 * @description Middleware que verifica o token de acesso (Bearer token) no cabeçalho
 * de autorização. Se o token for válido, anexa os dados do usuário (`id` e `email`)
 * ao objeto `req` e passa para o próximo middleware. Caso contrário, retorna um erro.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: "Acesso não autorizado, token não fornecido." });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as JwtPayload;

    // Anexa o payload do usuário à requisição, em conformidade com a tipagem global.
    req.user = {
      id: decoded.userId,
      email: decoded.email,
    };
    
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Acesso negado, token inválido ou expirado." });
  }
};