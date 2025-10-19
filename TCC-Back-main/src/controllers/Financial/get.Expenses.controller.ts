// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Despesas por Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista paginada
 * de todas as despesas associadas a uma propriedade específica.
 *
 * O acesso a este endpoint é seguro, sendo restrito apenas a membros autenticados
 * da propriedade. A funcionalidade é robusta, suportando paginação e múltiplos
 * filtros, como status, categoria e período de datas.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'financial.log';

// Schema para validar os parâmetros da rota e da query.
const getExpensesSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 15)).refine(val => val > 0),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0),
  status: z.string().optional(),
  categoria: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Processa a requisição para buscar e listar as despesas de uma propriedade.
 */
export const getExpensesByProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    const { propertyId, limit, page, status, categoria, startDate, endDate } = getExpensesSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é membro da propriedade que está tentando acessar.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: { idPropriedade: propertyId, idUsuario: userId }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Você não tem permissão para visualizar as despesas desta propriedade.'
        });
    }

    // --- 3. Construção da Cláusula de Busca ---
    const skip = (page - 1) * limit;
    const where: Prisma.DespesaWhereInput = {
      idPropriedade: propertyId,
      status: status ? (status as any) : { not: 'CANCELADO' }, // Filtra por status ou exclui cancelados por padrão
    };

    if (categoria) {
      where.categoria = { contains: categoria };
    }
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // --- 4. Execução das Consultas Paginadas em Transação ---
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

    // --- 5. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Despesas recuperadas com sucesso.",
      data: {
        despesas,
        pagination: { page, limit, totalRecords: total, totalPages },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao buscar despesas: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao buscar despesas.' });
  }
};