// D:\Qota - TCC\TCC-Back_End\TCC-Back\src\controllers\Inventory\getByProperty.Inventory.controller.ts

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validar o ID da propriedade vindo da URL
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
      // ADIÇÃO IMPORTANTE: Inclui as fotos relacionadas a cada item.
      include: {
        fotos: true, // Isso trará um array 'fotos' para cada item do inventário
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Itens do inventário recuperados com sucesso.',
      data: inventoryItems,
    });
  } catch (error) {
    // Tratamento de erros de validação
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    // Tratamento de outros erros
    console.error('Erro ao buscar inventário por propriedade:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};