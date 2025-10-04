// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deleteUserByIdSchema = z.object({
  // A validação de parâmetros de rota é feita na cadeia de validação,
  // não no construtor do z.string().
  id: z
    .string() // Valida que é uma string
    .regex(/^\d+$/, { message: 'O ID do usuário deve ser um número válido.' }) // Valida que contém apenas dígitos
    .transform(val => parseInt(val, 10)) // Converte para número
    .refine(val => val > 0, { message: 'O ID do usuário é inválido.' }),
});

export const deleteUserById = async (req: Request, res: Response) => {
  try {
    const { id } = deleteUserByIdSchema.parse(req.params);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.',
      });
    }

    await prisma.user.update({
      where: { id },
      data: { excludedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: 'Usuário deletado com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    console.error(`Erro ao deletar usuário ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
    });
  }
};