// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem Paginada de Convites Pendentes por Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint que recupera uma lista paginada de
 * convites pendentes e válidos para uma propriedade específica.
 *
 * O acesso a este endpoint é seguro, sendo restrito a usuários autenticados que
 * possuam a permissão de 'proprietario_master' na propriedade em questão,
 * garantindo a privacidade dos e-mails dos convidados.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'invite.log';

// Schema para validar os parâmetros da rota (ID da propriedade) e da query (paginação).
const getPendingInvitesSchema = z.object({
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
 * Processa a requisição para buscar os convites pendentes de uma propriedade.
 */
export const getPendingByProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    const { propertyId, limit, page } = getPendingInvitesSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: propertyId,
            idUsuario: userId,
            permissao: 'proprietario_master'
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas proprietários master podem visualizar os convites pendentes.'
        });
    }

    // --- 3. Execução das Consultas Paginadas em Transação ---
    const skip = (page - 1) * limit;
    const where: Prisma.ConviteWhereInput = {
      idPropriedade: propertyId,
      status: 'PENDENTE',
      dataExpiracao: { gte: new Date() },
    };

    const [pendingInvites, total] = await prisma.$transaction([
      prisma.convite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          emailConvidado: true,
          permissao: true,
          numeroDeFracoes: true,
          dataExpiracao: true,
        },
        skip,
        take: limit,
      }),
      prisma.convite.count({ where }),
    ]);

    // --- 4. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Convites pendentes recuperados com sucesso.',
      data: pendingInvites,
      pagination: {
        totalRecords: total,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar convites pendentes: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar os convites.',
    });
  }
};