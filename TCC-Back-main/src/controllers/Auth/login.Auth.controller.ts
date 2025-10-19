// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Autenticação de Usuário (Login)
 *
 * Descrição:
 * Este arquivo contém a lógica de negócio para o endpoint de login. Ele é responsável
 * por receber as credenciais do usuário (e-mail e senha), validar os dados de entrada,
 * verificar a identidade do usuário no banco de dados, e, em caso de sucesso,
 * gerar e retornar os tokens de autenticação (Access e Refresh Token).
 *
 * O Refresh Token é armazenado de forma segura em um cookie httpOnly, enquanto o
 * Access Token e os dados do usuário são retornados no corpo da resposta para
 * uso imediato pelo frontend.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'auth.log';

// Define o schema de validação para os dados do corpo da requisição de login.
const loginSchema = z.object({
  email: z.string().email({ message: 'O formato do e-mail é inválido.' }),
  password: z.string().min(1, { message: 'A senha é obrigatória.' }),
});

// Constantes para configuração dos tokens, facilitando a manutenção.
const ACCESS_TOKEN_EXPIRATION = '6h';
const REFRESH_TOKEN_EXPIRATION = '7d';
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias em milissegundos.

/**
 * Processa a tentativa de login de um usuário.
 */
export const loginAuth = async (req: Request, res: Response) => {
  try {
    // --- 1. Validação dos Dados de Entrada ---
    const { email, password } = loginSchema.parse(req.body);

    // --- 2. Busca e Verificação do Usuário ---
    // Busca o usuário pelo e-mail. A condição `excludedAt: null` impede que
    // contas desativadas (soft deleted) possam realizar login.
    const user = await prisma.user.findFirst({
      where: {
        email,
        excludedAt: null,
      },
      include: {
        userPhoto: true, // Inclui a foto para otimizar o carregamento no frontend.
      },
    });

    // Compara a senha fornecida com o hash armazenado de forma segura.
    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : false;

    // Se o usuário não existe ou a senha está incorreta, retorna uma mensagem
    // de erro genérica para não vazar informações sobre qual campo estava errado.
    if (!user || !passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'E-mail ou senha inválidos.',
      });
    }

    // --- 3. Geração dos Tokens de Acesso e Atualização ---
    // O Access Token tem vida útil curta e contém os dados para identificação do usuário.
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: ACCESS_TOKEN_EXPIRATION }
    );

    // O Refresh Token tem vida útil longa e serve para renovar o Access Token.
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: REFRESH_TOKEN_EXPIRATION }
    );

    // --- 4. Armazenamento do Refresh Token ---
    // Armazena o novo refresh token no banco, invalidando sessões anteriores.
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // --- 5. Configuração do Cookie Seguro ---
    // Envia o refresh token em um cookie httpOnly, protegendo-o contra ataques XSS.
    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Envio apenas via HTTPS em produção.
      sameSite: 'lax', // Proteção contra ataques CSRF.
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: `Usuário ${user.nomeCompleto} logado com sucesso.`,
      data: {
        accessToken,
        id: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
        cpf: user.cpf,
        telefone: user.telefone,
        userPhoto: user.userPhoto
          ? {
              url: `${req.protocol}://${req.get('host')}${user.userPhoto.url}`,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO no processo de login: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor.',
    });
  }
};