// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem Paginada de Notificações por Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista paginada
 * de todas as notificações associadas a uma propriedade específica.
 *
 * O endpoint é seguro e performático:
 * 1.  Autenticação e Autorização: Garante que apenas usuários autenticados que
 * são membros da propriedade possam visualizar suas notificações.
 * 2.  Paginação: Retorna os dados em páginas para otimizar a performance.
 * 3.  Ordenação: Os resultados são sempre ordenados da notificação mais recente
 * para a mais antiga.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'notification.log';

// Define o schema de validação para os parâmetros da rota (ID) e da query (paginação).
const getNotificationsSchema = z.object({
  propertyId: z.string().transform((val) => parseInt(val, 10)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0),
});

/**
 * Processa a requisição para buscar as notificações de uma propriedade com paginação e segurança.
 */
export const getNotificationsByProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    const { propertyId, limit, page } = getNotificationsSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    // --- 2. Verificação de Autorização (Membro da Propriedade) ---
    // Garante que o usuário autenticado é membro da propriedade que está tentando acessar.
    const userIsMember = await prisma.usuariosPropriedades.findFirst({
      where: {
        idPropriedade: propertyId,
        idUsuario: userId,
      },
    });

    if (!userIsMember) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não tem permissão para ver as notificações desta propriedade.',
      });
    }

    // --- 3. Execução das Consultas Paginadas em Transação ---
    const skip = (page - 1) * limit;
    const where: Prisma.NotificacaoWhereInput = { idPropriedade: propertyId };

    const [notifications, total] = await prisma.$transaction([
      prisma.notificacao.findMany({
        where,
        orderBy: { createdAt: 'desc' }, // Ordena da mais nova para a mais antiga.
        select: {
          id: true,
          mensagem: true,
          createdAt: true,
          autor: {
            select: {
              id: true,
              nomeCompleto: true,
            },
          },
          lidaPor: {
            select: {
              id: true, // Retorna os IDs dos usuários que leram a notificação.
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.notificacao.count({ where }),
    ]);

    // --- 4. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Notificações recuperadas com sucesso.',
      data: notifications,
      pagination: {
        totalRecords: total,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar notificações: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar as notificações.',
    });
  }
};