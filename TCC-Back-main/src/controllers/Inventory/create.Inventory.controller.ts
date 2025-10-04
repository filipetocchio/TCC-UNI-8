// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const createInventoryItemSchema = z.object({
  idPropriedade: z.number().int().positive({ message: 'O ID da propriedade é obrigatório.' }),
  nome: z.string().min(1, { message: 'O nome do item é obrigatório.' }).max(150),
  quantidade: z.number().int().positive().optional().default(1),
  estadoConservacao: z.enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO']).optional().default('BOM'),
  categoria: z.string().optional(),
  dataAquisicao: z.string().datetime().optional().nullable(),
  descricao: z.string().optional().nullable(),
  valorEstimado: z.number().positive().optional().nullable(),
  codigoBarras: z.string().optional().nullable(),
});

export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const validatedData = createInventoryItemSchema.parse(req.body);

    const propertyExists = await prisma.propriedades.findFirst({
      where: {
        id: validatedData.idPropriedade,
        excludedAt: null,
      },
    });

    if (!propertyExists) {
      return res.status(404).json({
        success: false,
        message: 'Propriedade não encontrada ou está inativa.',
      });
    }

    const newItem = await prisma.itemInventario.create({
      data: {
        nome: validatedData.nome,
        quantidade: validatedData.quantidade,
        estadoConservacao: validatedData.estadoConservacao,
        categoria: validatedData.categoria,
        descricao: validatedData.descricao,
        valorEstimado: validatedData.valorEstimado,
        codigoBarras: validatedData.codigoBarras,
        dataAquisicao: validatedData.dataAquisicao ? new Date(validatedData.dataAquisicao) : null,
        propriedade: {
          connect: {
            id: validatedData.idPropriedade,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: `Item "${newItem.nome}" adicionado ao inventário com sucesso.`,
      data: newItem,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    console.error('Erro ao criar item de inventário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};