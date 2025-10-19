// Todos direitos autorais reservados pelo QOTA.

/**
 * Middleware de Autenticação (Protect)
 *
 * Descrição:
 * Este arquivo contém o middleware `protect`, responsável por proteger as rotas
 * da API. Ele intercepta as requisições, verifica a presença e a validade de um
 * JSON Web Token (JWT) no cabeçalho de autorização e, em caso de sucesso, anexa
 * os dados do usuário autenticado ao objeto da requisição (`req.user`).
 *
 * Rotas que utilizam este middleware só poderão ser acessadas por usuários
 * autenticados com um token válido.
 */
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';


interface JwtPayload {
  userId: number;
  email: string;
  nomeCompleto: string;
}

/**
 * Middleware para proteger rotas. Verifica o token JWT e anexa os dados
 * do usuário (`id`, `email`, `nomeCompleto`) ao objeto da requisição.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
  try {
    // --- 1. Verificação do Cabeçalho de Autorização ---
    const authHeader = req.headers.authorization;

    // Garante que o cabeçalho de autorização existe e segue o padrão "Bearer".
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. O token de autenticação não foi fornecido ou está mal formatado.',
      });
    }

    // --- 2. Extração do Token ---
    const token = authHeader.split(' ')[1];

    // --- 3. Verificação e Decodificação do Token ---
    // O bloco try...catch lida com erros de verificação do JWT, como tokens
    // expirados ou com assinatura inválida.
    const decoded = jwt.verify(
      token,
      // Garante que a chave secreta do token esteja configurada no ambiente.
      process.env.ACCESS_TOKEN_SECRET as string
    ) as JwtPayload;

    // --- 4. Anexação dos Dados do Usuário à Requisição ---
    // Anexa os dados decodificados do usuário ao objeto `req`, tornando-os
    // acessíveis para os próximos controladores na cadeia de processamento.
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      nomeCompleto: decoded.nomeCompleto,
    };
    
    // Passa o controle para o próximo middleware ou para o controlador da rota.
    next();
  } catch (error) {
    // Se a verificação do token falhar, retorna um erro 403 (Forbidden),
    // indicando que o token é inválido ou expirou.
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. O token fornecido é inválido ou expirou.',
    });
  }
};