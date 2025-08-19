import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email({ message: "Formato de e-mail inválido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  nomeCompleto: z.string().min(1, { message: "O nome completo é obrigatório." }).max(100, { message: "O nome completo não pode exceder 100 caracteres." }),
  cpf: z.string().length(11, { message: "O CPF deve ter exatamente 11 dígitos." }).regex(/^\d+$/, { message: "O CPF deve conter apenas dígitos." }),
  telefone: z.string().optional().refine(val => !val || /^\d{10,11}$/.test(val), { message: "O número de telefone deve ter 10 ou 11 dígitos." }),
});

const registerAuth = async (req: Request, res: Response) => {
  try {
    const { email, password, nomeCompleto, cpf, telefone } = registerSchema.parse(req.body);

    const duplicate = await prisma.user.findFirst({
      where: { OR: [{ email }, { cpf }] },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: duplicate.email === email ? "Este e-mail já está em uso." : "Este CPF já está em uso.",
        message: duplicate.email === email ? "Este e-mail já está em uso." : "Este CPF já está em uso.",
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
      },
    });

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
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
        email: user.email,
        id: user.id,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        message: error.errors[0].message,
      });
    }
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor.",
      message: "Erro interno do servidor.",
    });
  }
};

export { registerAuth };