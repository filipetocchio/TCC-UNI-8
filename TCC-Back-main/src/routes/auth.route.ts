// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Autenticação
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * ciclo de vida da autenticação de um usuário. Isso inclui o registro de novas
 * contas, o login, o logout e a renovação de tokens de sessão.
 */
import express from 'express';
import { registerAuth } from '../controllers/Auth/register.controller';
import { loginAuth } from '../controllers/Auth/login.Auth.controller';
import { logoutAuth } from '../controllers/Auth/logout.Auth.controller';
import { refreshTokenAuth } from '../controllers/Auth/refreshToken.Auth.controller';
import { protect } from '../middleware/authMiddleware';

// Criação do roteador para o escopo de autenticação.
export const auth = express.Router();

// Rota para registrar um novo usuário no sistema.
// Acesso: Público.
auth.post('/register', registerAuth);

// Rota para autenticar um usuário existente e iniciar uma sessão.
// Acesso: Público.
auth.post('/login', loginAuth);

// Rota para encerrar a sessão de um usuário.
// Acesso: Privado (requer autenticação via 'protect' middleware).
auth.post('/logout', protect, logoutAuth);

// Rota para renovar um token de acesso expirado usando um refresh token válido.
// Acesso: Público (a validação é feita pelo refresh token no cookie).
auth.post('/refresh', refreshTokenAuth);