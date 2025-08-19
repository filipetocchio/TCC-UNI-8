import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deletePropertyByIdSchema = z.object({
  id: z
    .string({ required_error: 'O parâmetro id é obrigatório.' })
    .regex(/^\d+$/, { message: 'ID da propriedade deve ser um número válido.' })
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'ID da propriedade inválido.' }),
});

const deletePropertyById = async (req: Request, res: Response) => {
  try {
    const { id } = deletePropertyByIdSchema.parse(req.params);

    const property = await prisma.propriedades.findUnique({
      where: { id: id },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Propriedade não encontrada.',
        error: 'Propriedade não encontrada.',
      });
    }

    if (property.excludedAt) {
      return res.status(400).json({
        success: false,
        message: 'Propriedade já foi deletada (soft delete).',
        error: 'Propriedade já foi deletada (soft delete).',
      });
    }

    await prisma.propriedades.update({
      where: { id: id },
      data: {
        excludedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Propriedade deletada com sucesso (soft delete).',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
        error: error.errors[0].message,
      });
    }

    console.error(`Erro ao deletar propriedade por ID ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
      error: 'Ocorreu um erro ao processar a solicitação.',
    });
  }
};
export { deletePropertyById };
