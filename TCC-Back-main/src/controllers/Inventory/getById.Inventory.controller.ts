// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * Schema para validar o parâmetro de ID da rota, garantindo que seja um número válido.
 */
const paramsSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, { message: "O ID do item deve ser um número." })
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: "O ID do item é inválido." }),
});

/**
 * Busca um item de inventário específico por ID, incluindo
 * apenas as fotos que não foram marcadas como excluídas.
 */
export const getInventoryItemById = async (req: Request, res: Response) => {
  try {
    const { id } = paramsSchema.parse(req.params);

    const inventoryItem = await prisma.itemInventario.findUnique({
      where: { id },
      include: {
        // Filtra para incluir apenas as fotos que não foram soft-deletadas.
        fotos: {
          where: {
            excludedAt: null,
          },
        },
      },
    });

    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: 'Item de inventário não encontrado.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Item de inventário recuperado com sucesso.',
      data: inventoryItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar o item.' });
  }
};
