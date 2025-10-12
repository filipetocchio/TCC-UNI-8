// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const summarySchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const getFinancialSummary = async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate } = summarySchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    const wherePaid: Prisma.PagamentoCotistaWhereInput = {
      pago: true,
      dataPagamento: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      despesa: {
        idPropriedade: propertyId,
        status: { not: 'CANCELADO' },
      },
    };

    const wherePending: Prisma.DespesaWhereInput = {
      idPropriedade: propertyId,
      status: 'PENDENTE',
     
    };

    const [paidSummary, expensesByCategory, projectedSpendingSummary] = await prisma.$transaction([
      prisma.pagamentoCotista.aggregate({
        _sum: { valorDevido: true },
        _count: { id: true },
        where: wherePaid,
      }),
      prisma.pagamentoCotista.groupBy({
        by: ['idDespesa'],
        
        orderBy: {
          idDespesa: 'asc',
        },
        _sum: { valorDevido: true },
        where: wherePaid,
      }),
      prisma.despesa.aggregate({
        _sum: { valor: true },
        where: wherePending,
      }),
    ]);
    
    const paidExpenseIds = expensesByCategory.map(e => e.idDespesa);
    const paidExpenses = await prisma.despesa.findMany({
      where: { id: { in: paidExpenseIds } },
      select: { id: true, categoria: true },
    });
    
    const expenseCategoryMap = new Map(paidExpenses.map(e => [e.id, e.categoria]));

    const categoryTotals = expensesByCategory.reduce((acc, p) => {
      const category = expenseCategoryMap.get(p.idDespesa) || 'Outros';
      acc[category] = (acc[category] || 0) + (p._sum?.valorDevido || 0);
      return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(categoryTotals)
      .map(([name, valor]) => ({ name, valor: parseFloat(valor.toFixed(2)) }))
      .sort((a, b) => b.valor - a.valor);
    
    const totalSpent = paidSummary._sum.valorDevido || 0;
    const projectedSpending = projectedSpendingSummary._sum.valor || 0;
    const topCategory = chartData[0]?.name || 'N/A';
    
    return res.status(200).json({
      success: true,
      data: {
        totalSpent,
        projectedSpending,
        topCategory,
        chartData,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error("Erro ao gerar resumo financeiro:", error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao gerar o resumo financeiro.' });
  }
};