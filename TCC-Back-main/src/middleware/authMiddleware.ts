// Todos direitos autorais reservados pelo QOTA.

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// A definição do payload do token agora inclui o nome do usuário.
interface JwtPayload {
  userId: number;
  email: string;
  nomeCompleto: string; // Campo adicionado
}

/**
 * Middleware para proteger rotas. Verifica o token JWT e anexa os dados
 * do usuário (`id`, `email`, `nomeCompleto`) ao objeto da requisição.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: "Acesso não autorizado, token não fornecido." });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as JwtPayload;

    // Anexa o payload completo, incluindo o nome, à requisição.
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      nomeCompleto: decoded.nomeCompleto,
    };
    
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Acesso negado, token inválido ou expirado." });
  }
};