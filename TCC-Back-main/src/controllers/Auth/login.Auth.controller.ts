// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";

/**
 * Define o schema de validação para os dados de entrada do login.
 */
const loginSchema = z.object({
  email: z.string().email({ message: "O formato do e-mail é inválido." }),
  password: z.string().min(1, { message: "A senha é obrigatória." }),
});

/**
 * Processa a autenticação de um usuário.
 * Valida as credenciais, gera tokens JWT e retorna o objeto completo do usuário
 * para otimizar o carregamento no frontend.
 * @param req - O objeto de requisição do Express.
 * @param res - O objeto de resposta do Express.
 */
export const loginAuth = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Busca um usuário ATIVO no banco de dados pelo e-mail fornecido.
    // A condição 'excludedAt: null' garante que contas encerradas não possam fazer login.
    const user = await prisma.user.findFirst({
      where: { 
        email,
        excludedAt: null, // Assegura que apenas usuários ativos sejam considerados.
      },
      include: {
        userPhoto: true,
      },
    });

    const passwordMatch = user ? await bcrypt.compare(password, user.password) : false;

    if (!user || !passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "E-mail ou senha inválidos.",
      });
    }

    const accessToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        nomeCompleto: user.nomeCompleto 
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: "6h" }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email }, 
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: "7d" }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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
          ? { url: `${req.protocol}://${req.get('host')}${user.userPhoto.url}` }
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

    console.error("Falha no processo de login:", error);

    return res.status(500).json({
      success: false,
      message: "Ocorreu um erro inesperado no servidor.",
    });
  }
};