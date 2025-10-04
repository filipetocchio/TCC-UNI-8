// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import { z } from "zod";

const getUserByIdSchema = z.object({
  id: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: "ID must be a positive number." }),
});

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = getUserByIdSchema.parse(req.params);

    const domain = req.protocol + '://' + req.get('host');

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        telefone: true,
        dataCadastro: true,
        userPhoto: { select: { url: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado.",
      });
    }

    if (user.userPhoto?.url) {
      user.userPhoto.url = domain + user.userPhoto.url;
    }

    return res.status(200).json({
      success: true,
      message: "Usuário recuperado com sucesso.",
      data: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        
        message: error.issues[0].message,
      });
    }
    console.error("Erro no getUserById:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
  }
};