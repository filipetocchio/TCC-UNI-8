// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getInventorySchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'O ID da propriedade é inválido.' }),
});

/**
 * Busca e retorna todos os itens de inventário de uma propriedade,
 * garantindo que apenas as fotos não excluídas sejam incluídas.
 */
export const getInventoryByProperty = async (req: Request, res: Response) => {
  try {
    const { propertyId } = getInventorySchema.parse(req.params);

    const inventoryItems = await prisma.itemInventario.findMany({
      where: {
        idPropriedade: propertyId,
        excludedAt: null, // Busca apenas itens de inventário ativos
      },
      orderBy: {
        nome: 'asc',
      },
      include: {
      
        fotos: {
          where: {
            excludedAt: null, // Traz apenas as fotos que não foram soft-deletadas.
          },
        },
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
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar o inventário.' });
  }
};