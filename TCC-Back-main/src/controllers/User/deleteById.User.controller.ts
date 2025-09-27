// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deleteUserByIdSchema = z.object({
  id: z
    .string({ required_error: 'O parâmetro id é obrigatório.' })
    .regex(/^\d+$/, { message: 'ID do usuário deve ser um número válido.' })
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'ID do usuário inválido.' }),
});

const deleteUserById = async (req: Request, res: Response) => {
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
        message: error.errors[0].message,
      });
    }

    console.error(`Erro ao deletar usuário ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
    });
  }
};

export { deleteUserById };