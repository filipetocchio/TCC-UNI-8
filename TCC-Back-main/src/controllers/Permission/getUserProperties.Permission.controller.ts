// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Membros de uma Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista paginada
 * de todos os membros (usuários) associados a uma propriedade específica.
 *
 * O acesso a este endpoint é seguro, sendo restrito apenas a membros autenticados
 * da propriedade em questão. A funcionalidade suporta paginação e a filtragem de
 * membros por status (ativos ou inativos).
 */
import { Request, Response } from 'express';
import { prisma } from '../../utils/prisma';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';
import { Prisma } from '@prisma/client';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'permissionAccess.log';

// --- Schemas de Validação ---

// Schema para validar os parâmetros da rota (ID) e da query (paginação/filtro).
const getPropertyUsersSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, {
    message: 'O ID da propriedade deve ser um número positivo.',
  }),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)).refine((val) => val > 0),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)).refine((val) => val > 0),
  showDeleted: z.enum(['true', 'false', 'only']).optional().default('false'),
});

/**
 * Processa a requisição para buscar e listar os membros de uma propriedade específica.
 */
export const getUserPropertiesPermission = async (
  req: Request,
  res: Response
) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    const { id: propertyId, limit, page, showDeleted } = getPropertyUsersSchema.parse({
      id: req.params.id,
      ...req.query
    });

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um membro da propriedade que está tentando acessar.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: propertyId,
            idUsuario: userId,
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Você não tem permissão para visualizar os membros desta propriedade.'
        });
    }

    // --- 3. Construção da Cláusula de Busca ---
    const userStatusFilter =
      showDeleted === 'true'
        ? {}
        : showDeleted === 'only'
        ? { excludedAt: { not: null } }
        : { excludedAt: null };

    const whereClause: Prisma.UsuariosPropriedadesWhereInput = {
      idPropriedade: propertyId,
      usuario: userStatusFilter,
    };

    // --- 4. Execução das Consultas em uma Transação ---
    const [totalRecords, userLinks] = await prisma.$transaction([
      prisma.usuariosPropriedades.count({ where: whereClause }),
      prisma.usuariosPropriedades.findMany({
        where: whereClause,
        include: {
          usuario: {
            select: { id: true, nomeCompleto: true, email: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // --- 5. Formatação dos Dados para a Resposta ---
    // Mapeia os resultados para um formato limpo, incluindo os novos campos de frações e saldo.
    const formattedUsers = userLinks.map((link) => ({
      idVinculo: link.id,
      idUsuario: link.usuario.id,
      nomeCompleto: link.usuario.nomeCompleto,
      email: link.usuario.email,
      permissao: link.permissao,
      numeroDeFracoes: link.numeroDeFracoes,
      saldoDiariasAtual: link.saldoDiariasAtual,
    }));

    // --- 6. Envio da Resposta Estruturada ---
    return res.status(200).json({
      success: true,
      message: 'Membros da propriedade recuperados com sucesso.',
      data: formattedUsers,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
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
    logEvents(`ERRO ao buscar membros da propriedade: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar os membros.',
    });
  }
};