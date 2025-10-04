// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deleteParamsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'ID inválido.' }),
});

export const deleteInventoryItemById = async (req: Request, res: Response) => {
  try {
    const { id } = deleteParamsSchema.parse(req.params);

    const itemExists = await prisma.itemInventario.findFirst({
      where: { id, excludedAt: null },
    });

    if (!itemExists) {
      return res.status(404).json({ success: false, message: 'Item de inventário não encontrado ou já deletado.' });
    }

    await prisma.itemInventario.update({
      where: { id },
      data: {
        excludedAt: new Date(),
      },
    });

    return res.status(200).json({ success: true, message: 'Item deletado com sucesso.' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error('Erro ao deletar item de inventário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};