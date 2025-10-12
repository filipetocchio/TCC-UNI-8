// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const getExpensesSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 15)).refine(val => val > 0),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0),
  status: z.string().optional(),
  categoria: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const getExpensesByProperty = async (req: Request, res: Response) => {
  try {
    const { propertyId, limit, page, status, categoria, startDate, endDate } = getExpensesSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    const skip = (page - 1) * limit;
    const where: Prisma.DespesaWhereInput = {
      idPropriedade: propertyId,
     
      status: { not: 'CANCELADO' },
    };


    // usuário peça para ver os cancelados.
    if (status) {
      where.status = status as any;
    }

    if (categoria) {
      where.categoria = { contains: categoria }; 
    }
    
    if (startDate && endDate) {

      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [despesas, total] = await prisma.$transaction([
      prisma.despesa.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataVencimento: 'desc' },
        include: { pagamentos: { select: { pago: true } } },
      }),
      prisma.despesa.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Despesas recuperadas com sucesso.",
      data: {
        despesas,
        pagination: { page, limit, total, totalPages },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar despesas.' });
  }
};