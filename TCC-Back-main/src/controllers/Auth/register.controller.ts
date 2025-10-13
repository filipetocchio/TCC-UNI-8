// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { Prisma } from '@prisma/client'; // Importa os tipos do Prisma

const TERMOS_VERSAO_ATUAL = "1.0 - 2025-08-25";

const registerSchema = z.object({
  email: z.string().email({ message: "Formato de e-mail inválido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  nomeCompleto: z.string().min(1, { message: "O nome completo é obrigatório." }),
  cpf: z.string().length(11, { message: "O CPF deve ter exatamente 11 dígitos." }),
  telefone: z.string().optional().refine(val => !val || /^\d{10,11}$/.test(val), { message: "O número de telefone deve ter 10 ou 11 dígitos." }),
  termosAceitos: z.coerce.boolean().refine(data => data === true, {
    message: "Você deve aceitar os Termos de Uso e a Política de Privacidade para se cadastrar.",
  }),
});

/**
 * Realiza o cadastro de um novo usuário no sistema.
 * Verifica a duplicidade de e-mail e CPF apenas entre usuários ativos
 * antes de criar o novo registro.
 * @param req - O objeto de requisição do Express.
 * @param res - O objeto de resposta do Express.
 */
export const registerAuth = async (req: Request, res: Response) => {
  try {
    const { email, password, nomeCompleto, cpf, telefone } = registerSchema.parse(req.body);

    const duplicate = await prisma.user.findFirst({
      where: { 
        AND: [
          { excludedAt: null },
          {
            OR: [
              { email }, 
              { cpf }
            ] 
          }
        ]
      },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: duplicate.email === email ? "Este e-mail já está em uso por uma conta ativa." : "Este CPF já está em uso por uma conta ativa.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nomeCompleto,
        cpf,
        telefone,
        refreshToken: "", 
        dataConsentimento: new Date(),
        versaoTermos: TERMOS_VERSAO_ATUAL,
      },
    });

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
      { expiresIn: "1d" }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      success: true,
      message: `Novo usuário ${nomeCompleto} criado.`,
      data: {
        accessToken,
        id: user.id,
        email: user.email,
      },
    });

  } catch (error: unknown) {
    // Trata erros de validação do Zod.
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }
    
    // Trata erros conhecidos do Prisma, como violação de constraint única.
    // É necessário verificar se o 'error' é uma instância do erro do Prisma
    // para acessar suas propriedades de forma segura.
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
          return res.status(409).json({
              success: false,
              message: `Conflito de dados. O e-mail ou CPF já foi registrado.`,
          });
      }
    }
    
    // Loga qualquer outro erro inesperado no servidor.
    console.error("Erro no registro:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor.",
    });
  }
};