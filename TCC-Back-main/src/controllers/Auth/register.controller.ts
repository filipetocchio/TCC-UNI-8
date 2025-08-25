import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";

/**
 * @constant TERMOS_VERSAO_ATUAL
 * @description Define a versão atual dos termos legais.
 * Armazenar isso no banco de dados cria uma trilha de auditoria,
 * permitindo saber exatamente qual versão dos termos o usuário aceitou.
 * Lembre-se de atualizar esta data/versão sempre que seus termos mudarem.
 */
const TERMOS_VERSAO_ATUAL = "1.0 - 2025-08-25";

const registerSchema = z.object({
  email: z.string().email({ message: "Formato de e-mail inválido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  nomeCompleto: z.string().min(1, { message: "O nome completo é obrigatório." }).max(100, { message: "O nome completo não pode exceder 100 caracteres." }),
  cpf: z.string().length(11, { message: "O CPF deve ter exatamente 11 dígitos." }).regex(/^\d+$/, { message: "O CPF deve conter apenas dígitos." }),
  telefone: z.string().optional().refine(val => !val || /^\d{10,11}$/.test(val), { message: "O número de telefone deve ter 10 ou 11 dígitos." }),
  
  // --- VALIDAÇÃO LGPD ---
  // Exige que o campo 'termosAceitos' seja enviado no corpo da requisição
  // e que seu valor seja estritamente 'true'.
  termosAceitos: z.literal(true, {
    errorMap: () => ({ message: "Você deve aceitar os Termos de Uso e a Política de Privacidade para se cadastrar." }),
  }),
});

const registerAuth = async (req: Request, res: Response) => {
  try {
    // A validação do Zod agora também verifica o campo 'termosAceitos'
    const { email, password, nomeCompleto, cpf, telefone } = registerSchema.parse(req.body);

    const duplicate = await prisma.user.findFirst({
      where: { OR: [{ email }, { cpf }] },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
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
        refreshToken: "", // Será atualizado em seguida
        
        // --- ARMAZENAMENTO DO CONSENTIMENTO LGPD ---
        // Registra a data/hora exatas do consentimento e a versão dos termos.
        dataConsentimento: new Date(),
        versaoTermos: TERMOS_VERSAO_ATUAL,
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
        message: error.errors[0].message,
      });
    }
    console.error("Erro no registro:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor.",
    });
  }
};

export { registerAuth };