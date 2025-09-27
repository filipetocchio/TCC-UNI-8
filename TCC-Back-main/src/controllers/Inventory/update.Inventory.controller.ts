// D:\Qota - TCC\TCC-Back_End\TCC-Back\src\controllers\Inventory\update.Inventory.controller.ts
// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validar os dados que podem ser atualizados. Todos são opcionais.
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

// Schema para validar o ID do item vindo da URL
const paramsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)),
});

export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    // 1. Validar o ID do item e os dados do corpo da requisição
    const { id } = paramsSchema.parse(req.params);
    const dataToUpdate = updateInventoryItemSchema.parse(req.body);

    // 2. Verificar se o item a ser atualizado realmente existe
    const itemExists = await prisma.itemInventario.findFirst({
      where: { id, excludedAt: null },
    });

    if (!itemExists) {
      return res.status(404).json({ success: false, message: 'Item de inventário não encontrado.' });
    }

    // 3. Atualizar o item no banco de dados
    const updatedItem = await prisma.itemInventario.update({
      where: { id },
      data: {
        ...dataToUpdate,
        // Converte a data de string para Date, se fornecida
        dataAquisicao: dataToUpdate.dataAquisicao ? new Date(dataToUpdate.dataAquisicao) : dataToUpdate.dataAquisicao,
      },
    });

    // 4. Retornar a resposta de sucesso
    return res.status(200).json({
      success: true,
      message: 'Item atualizado com sucesso.',
      data: updatedItem,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    console.error('Erro ao atualizar item de inventário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};