// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para o Resumo Financeiro da Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que gera um resumo financeiro
 * agregado para o dashboard de uma propriedade.
 *
 * O processo é seguro e otimizado para performance:
 * 1.  Valida a autenticação e autorização do usuário (se é membro da propriedade).
 * 2.  Executa consultas agregadas em paralelo para calcular o total gasto, a
 * previsão de gastos futuros e os dados para o gráfico de despesas.
 * 3.  Processa e formata os dados para fácil consumo pelo front-end.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'financial.log';

// Schema para validar os parâmetros da rota e da query.
const summarySchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

/**
 * Processa a requisição para gerar e retornar o resumo financeiro de uma propriedade.
 */
export const getFinancialSummary = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId } = req.user;
    
    const { propertyId, startDate, endDate } = summarySchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    // --- 2. Verificação de Autorização (Segurança) ---
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: { idPropriedade: propertyId, idUsuario: userId }
    });

    if (!userPermission) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Você não é membro desta propriedade.' });
    }

    // --- 3. Construção das Cláusulas de Busca ---
    const wherePaid: Prisma.PagamentoCotistaWhereInput = {
      pago: true,
      dataPagamento: { gte: new Date(startDate), lte: new Date(endDate) },
      despesa: { idPropriedade: propertyId, status: { not: 'CANCELADO' } },
    };

    const wherePending: Prisma.DespesaWhereInput = {
      idPropriedade: propertyId,
      status: 'PENDENTE',
    };

    // --- 4. Execução das Consultas Agregadas em Paralelo (Desempenho) ---
    const [paidSummary, paymentsForChart, projectedSpendingSummary] = await prisma.$transaction([
      // Query 1: Calcula o valor total gasto e a contagem de pagamentos.
      prisma.pagamentoCotista.aggregate({
        _sum: { valorDevido: true },
        _count: { id: true },
        where: wherePaid,
      }),
      // Query 2: Busca todos os pagamentos do período com a categoria da despesa associada.
      prisma.pagamentoCotista.findMany({
        where: wherePaid,
        select: {
          valorDevido: true,
          despesa: { select: { categoria: true } },
        },
      }),
      // Query 3: Calcula o valor total das despesas futuras que estão pendentes.
      prisma.despesa.aggregate({
        _sum: { valor: true },
        where: wherePending,
      }),
    ]);
    
    // --- 5. Processamento dos Dados do Gráfico em Memória (Desempenho) ---
    // Agrupa os pagamentos por categoria de forma eficiente.
    const categoryTotals = paymentsForChart.reduce((acc, payment) => {
      const category = payment.despesa.categoria || 'Outros';
      acc[category] = (acc[category] || 0) + (payment.valorDevido || 0);
      return acc;
    }, {} as Record<string, number>);

    const chartData = Object.entries(categoryTotals)
      .map(([name, valor]) => ({ name, valor: parseFloat(valor.toFixed(2)) }))
      .sort((a, b) => b.valor - a.valor);
    
    // --- 6. Consolidação e Envio da Resposta ---
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

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao gerar resumo financeiro: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao gerar o resumo financeiro.' });
  }
};