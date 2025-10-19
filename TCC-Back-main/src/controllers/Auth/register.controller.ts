// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Registro de Novos Usuários
 *
 * Descrição:
 * Este arquivo contém a lógica de negócio para o endpoint de registro. Ele é responsável
 * por validar os dados fornecidos por um novo usuário, verificar se o e-mail ou CPF
 * já estão em uso por uma conta ativa, criar o novo registro no banco de dados com
 * uma senha devidamente criptografada e, por fim, autenticar automaticamente o
 * usuário recém-criado, gerando e retornando os tokens de sessão.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'auth.log';

// --- Constantes de Configuração ---
const TERMOS_VERSAO_ATUAL = '1.0 - 2025-08-25';
const BCRYPT_SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRATION = '6h';
const REFRESH_TOKEN_EXPIRATION = '1d';
const REFRESH_TOKEN_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 1 dia em milissegundos.

// Define o schema de validação para os dados do corpo da requisição de registro.
const registerSchema = z.object({
  email: z.string().email({ message: 'O formato do e-mail é inválido.' }),
  password: z
    .string()
    .min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
  nomeCompleto: z
    .string()
    .min(1, { message: 'O nome completo é obrigatório.' }),
  cpf: z.string().length(11, { message: 'O CPF deve ter exatamente 11 dígitos.' }),
  telefone: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{10,11}$/.test(val), {
      message: 'O número de telefone deve ter 10 ou 11 dígitos.',
    }),
  termosAceitos: z.coerce.boolean().refine((data) => data === true, {
    message:
      'Você deve aceitar os Termos de Uso e a Política de Privacidade para se cadastrar.',
  }),
});

/**
 * Processa a criação de uma nova conta de usuário.
 */
export const registerAuth = async (req: Request, res: Response) => {
  try {
    // --- 1. Validação dos Dados de Entrada ---
    const { email, password, nomeCompleto, cpf, telefone } =
      registerSchema.parse(req.body);

    // --- 2. Verificação de Duplicidade (E-mail e CPF) ---
    // A busca por duplicatas é feita apenas entre usuários ativos (`excludedAt: null`).
    const duplicateUser = await prisma.user.findFirst({
      where: {
        AND: [{ excludedAt: null }, { OR: [{ email }, { cpf }] }],
      },
    });

    if (duplicateUser) {
      const message =
        duplicateUser.email === email
          ? 'Este e-mail já está em uso por uma conta ativa.'
          : 'Este CPF já está em uso por uma conta ativa.';
      return res.status(409).json({ success: false, message });
    }

    // --- 3. Hash da Senha ---
    // Criptografa a senha para garantir que ela não seja armazenada em texto plano.
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // --- 4. Criação do Novo Usuário ---
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nomeCompleto,
        cpf,
        telefone,
        dataConsentimento: new Date(),
        versaoTermos: TERMOS_VERSAO_ATUAL,
      },
    });

    // --- 5. Geração dos Tokens de Autenticação ---
    const accessToken = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        nomeCompleto: newUser.nomeCompleto,
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: ACCESS_TOKEN_EXPIRATION }
    );

    const refreshToken = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: REFRESH_TOKEN_EXPIRATION }
    );

    // --- 6. Armazenamento do Refresh Token e Configuração do Cookie ---
    await prisma.user.update({
      where: { id: newUser.id },
      data: { refreshToken },
    });

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    });

    // --- 7. Envio da Resposta de Sucesso ---
return res.status(201).json({
      success: true,
      message: `Novo usuário ${nomeCompleto} criado com sucesso.`,
      data: {
        accessToken,
        id: newUser.id,
        email: newUser.email,
        nomeCompleto: newUser.nomeCompleto,
        cpf: newUser.cpf,
        telefone: newUser.telefone,
        userPhoto: null, // Um novo usuário nunca tem foto de perfil.
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Conflito de dados. O e-mail ou CPF já foi registrado.',
        });
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO no processo de registro: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor durante o registro.',
    });
  }
};