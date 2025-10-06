// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';

const updateInventoryItemSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  quantidade: z.number().int().positive().optional(),
  estadoConservacao: z.enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO']).optional(),
  categoria: z.string().optional(),
  dataAquisicao: z.string().datetime().optional().nullable(),
  descricao: z.string().optional().nullable(),
  valorEstimado: z.number().positive().optional().nullable(),
  codigoBarras: z.string().optional().nullable(),
});

const paramsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Atualiza os dados de um item de inventário existente e notifica
 * os membros sobre a alteração.
 */
export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { id } = paramsSchema.parse(req.params);
    const dataToUpdate = updateInventoryItemSchema.parse(req.body);

    const itemExists = await prisma.itemInventario.findFirst({
      where: { id, excludedAt: null },
    });

    if (!itemExists) {
      return res.status(404).json({ success: false, message: 'O item de inventário não foi encontrado.' });
    }

    const updatedItem = await prisma.itemInventario.update({
      where: { id },
      data: {
        ...dataToUpdate,
        dataAquisicao: dataToUpdate.dataAquisicao ? new Date(dataToUpdate.dataAquisicao) : undefined,
      },
    });

    // 2. CRIA A NOTIFICAÇÃO APÓS A ATUALIZAÇÃO
    await createNotification({
        idPropriedade: updatedItem.idPropriedade,
        idAutor: userId,
        mensagem: `O usuário '${userName}' atualizou o item '${updatedItem.nome}' no inventário.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Item atualizado com sucesso.',
      data: updatedItem,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao atualizar o item.' });
  }
};