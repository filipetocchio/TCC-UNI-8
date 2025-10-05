// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const createInventoryItemSchema = z.object({
  idPropriedade: z.number().int().positive(),
  nome: z.string().min(1).max(150),
  quantidade: z.number().int().positive().optional().default(1),
  estadoConservacao: z.enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO']).optional().default('BOM'),
  categoria: z.string().optional(),
  dataAquisicao: z.string().datetime().optional().nullable(),
  descricao: z.string().optional().nullable(),
  valorEstimado: z.number().positive().optional().nullable(),
  codigoBarras: z.string().optional().nullable(),
});

/**
 * Cria um novo item de inventário associado a uma propriedade.
 */
export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const validatedData = createInventoryItemSchema.parse(req.body);

    const propertyExists = await prisma.propriedades.findFirst({
      where: { id: validatedData.idPropriedade, excludedAt: null },
    });

    if (!propertyExists) {
      return res.status(404).json({ success: false, message: 'A propriedade informada não foi encontrada ou está inativa.' });
    }

    const newItem = await prisma.itemInventario.create({
      data: {
        idPropriedade: validatedData.idPropriedade,
        nome: validatedData.nome,
        quantidade: validatedData.quantidade,
        estadoConservacao: validatedData.estadoConservacao,
        categoria: validatedData.categoria,
        dataAquisicao: validatedData.dataAquisicao ? new Date(validatedData.dataAquisicao) : null,
        descricao: validatedData.descricao,
        valorEstimado: validatedData.valorEstimado,
        codigoBarras: validatedData.codigoBarras,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Item "${newItem.nome}" adicionado com sucesso.`,
      data: newItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar o item.' });
  }
};