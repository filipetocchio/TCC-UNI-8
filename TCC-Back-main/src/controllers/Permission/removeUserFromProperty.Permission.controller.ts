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

const removeUserFromPropertyPermission = async (req: Request, res: Response) => {
  try {
    const deletedVinculos = await prisma.usuariosPropriedades.updateMany({
      where: {
        excludedAt: null,
      },
      data: {
        excludedAt: new Date(),
      },
    });

    if (deletedVinculos.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum vínculo encontrado para deletar.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `${deletedVinculos.count} vínculo(s) deletado(s) com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao deletar vínculos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
      error: 'Ocorreu um erro ao processar a solicitação.',
    });
  }
};

export { removeUserFromPropertyPermission };