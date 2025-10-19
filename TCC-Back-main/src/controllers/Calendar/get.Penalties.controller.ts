// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Penalidades Ativas
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista paginada
 * de todas as penalidades ativas para uma propriedade específica. Uma penalidade
 * é considerada ativa se sua data de fim ainda não foi atingida.
 *
 * O acesso a este endpoint é seguro, sendo restrito apenas a membros autenticados
 * da propriedade em questão.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'calendar.log';

// Schema para validar os parâmetros da requisição.
const getSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
});

/**
 * Busca e retorna uma lista paginada das penalidades ativas de uma propriedade.
 */
export const getPenaltiesByProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    const { propertyId, limit, page } = getSchema.parse({
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
            message: 'Acesso negado. Você não tem permissão para visualizar as penalidades desta propriedade.'
        });
    }

    // --- 3. Execução das Consultas Paginadas em Transação ---
    const skip = (page - 1) * limit;
    const where: Prisma.PenalidadeWhereInput = {
      idPropriedade: propertyId,
      dataFim: { gte: new Date() }, // Filtra apenas penalidades que ainda estão em vigor.
    };

    const [penalties, total] = await prisma.$transaction([
      prisma.penalidade.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          motivo: true,
          dataFim: true,
          createdAt: true,
          usuario: {
            select: {
              id: true,
              nomeCompleto: true,
            },
          },
        },
      }),
      prisma.penalidade.count({ where }),
    ]);

    // --- 4. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Penalidades recuperadas com sucesso.',
      data: {
        penalties,
        pagination: { page, limit, totalRecords: total, totalPages },
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar penalidades: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao buscar as penalidades.' });
  }
};