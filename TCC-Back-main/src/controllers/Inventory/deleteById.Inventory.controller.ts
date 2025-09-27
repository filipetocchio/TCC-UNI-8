// Todos direitos autorais reservados pelo QOTA.

// D:\Qota - TCC\TCC-Back_End\TCC-Back\src\controllers\Inventory\deleteById.Inventory.controller.ts

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validar o ID do item que vem pela URL
const deleteParamsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'ID inválido.' }),
});

export const deleteInventoryItemById = async (req: Request, res: Response) => {
  try {
    // 1. Validar o ID
    const { id } = deleteParamsSchema.parse(req.params);

    // 2. Checar se o item existe e não foi deletado ainda
    const itemExists = await prisma.itemInventario.findFirst({
      where: { id, excludedAt: null },
    });

    if (!itemExists) {
      return res.status(404).json({ success: false, message: 'Item de inventário não encontrado ou já deletado.' });
    }

    // 3. Realizar o soft delete, marcando o campo 'excludedAt' com a data atual
    await prisma.itemInventario.update({
      where: { id },
      data: {
        excludedAt: new Date(),
      },
    });

    // 4. Retornar mensagem de sucesso
    return res.status(200).json({ success: true, message: 'Item deletado com sucesso.' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    console.error('Erro ao deletar item de inventário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};