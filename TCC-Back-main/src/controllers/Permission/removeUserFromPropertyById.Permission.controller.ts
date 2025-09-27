// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deleteUserFromPropertySchema = z.object({
  id: z
    .string({ required_error: 'O parâmetro id é obrigatório.' })
    .regex(/^\d+$/, { message: 'ID do vínculo deve ser um número válido.' })
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'ID do vínculo inválido.' }),
});

const removeUserFromPropertyPermissionById = async (req: Request, res: Response) => {
  try {
    const { id } = deleteUserFromPropertySchema.parse(req.params);

    const vinculo = await prisma.usuariosPropriedades.findUnique({
      where: { id },
    });

    if (!vinculo) {
      return res.status(404).json({
        success: false,
        message: 'Vínculo não encontrado.',
        error: 'Vínculo não encontrado.',
      });
    }

    if (vinculo.excludedAt) {
      return res.status(400).json({
        success: false,
        message: 'Vínculo já foi deletado.',
        error: 'Vínculo já foi deletado.',
      });
    }

    await prisma.usuariosPropriedades.update({
      where: { id },
      data: { excludedAt: new Date() },
    });

    return res.status(200).json({
      success: true,
      message: 'Vínculo deletado com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
        error: error.errors[0].message,
      });
    }

    console.error(`Erro ao deletar vínculo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
      error: 'Ocorreu um erro ao processar a solicitação.',
    });
  }
};

export { removeUserFromPropertyPermissionById };