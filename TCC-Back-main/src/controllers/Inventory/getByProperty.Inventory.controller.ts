// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getInventorySchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'ID da propriedade inválido.' }),
});

export const getInventoryByProperty = async (req: Request, res: Response) => {
  try {
    const { propertyId } = getInventorySchema.parse(req.params);

    const inventoryItems = await prisma.itemInventario.findMany({
      where: {
        idPropriedade: propertyId,
        excludedAt: null,
      },
      orderBy: {
        nome: 'asc',
      },
      include: {
        fotos: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Itens do inventário recuperados com sucesso.',
      data: inventoryItems,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error('Erro ao buscar inventário por propriedade:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};