// D:\Qota - TCC\TCC-Back_End\TCC-Back\src\controllers\InventoryPhoto\deleteById.InventoryPhoto.controller.ts
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'ID da foto inválido.' }),
});

export const deleteInventoryPhotoById = async (req: Request, res: Response) => {
  try {
    const { id } = paramsSchema.parse(req.params);

    const photoExists = await prisma.fotoInventario.findFirst({
      where: { id, excludedAt: null },
    });

    if (!photoExists) {
      return res.status(404).json({ success: false, message: 'Foto não encontrada ou já deletada.' });
    }

    // Realiza o soft delete
    await prisma.fotoInventario.update({
      where: { id },
      data: { excludedAt: new Date() },
    });

    return res.status(200).json({ success: true, message: 'Foto deletada com sucesso.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    console.error('Erro ao deletar foto de inventário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};