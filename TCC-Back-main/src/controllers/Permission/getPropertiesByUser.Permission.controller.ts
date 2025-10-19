// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Propriedades por Usuário
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista paginada
 * de todas as propriedades associadas a um usuário específico.
 *
 * O acesso a este endpoint é seguro, permitindo que um usuário autenticado
 * visualize apenas a sua própria lista de propriedades. A funcionalidade suporta
 * paginação e a filtragem de propriedades por status (ativas ou inativas).
 * A resposta é formatada para incluir a permissão do usuário, seu número de
 * frações e seu saldo de diárias para cada propriedade.
 */
import { Request, Response } from 'express';
import { prisma } from '../../utils/prisma';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'permissionAccess.log';

// --- Schemas de Validação ---

// Schema para validar o ID do usuário vindo dos parâmetros da rota.
const getUserPropertiesSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, {
    message: 'O ID do usuário deve ser um número positivo.',
  }),
});

// Schema para validar os parâmetros de paginação e filtro da query string.
const getQueryParamsSchema = z.object({
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  showDeleted: z.enum(['true', 'false', 'only']).optional().default('false'),
});

/**
 * Processa a requisição para buscar e listar as propriedades de um usuário específico.
 */
export const getPropertiesByUser = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: requesterId } = req.user;
    const { id: targetUserId } = getUserPropertiesSchema.parse(req.params);
    const { limit, page, showDeleted } = getQueryParamsSchema.parse(req.query);

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que um usuário só pode listar suas próprias propriedades.
    if (requesterId !== targetUserId) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode visualizar sua própria lista de propriedades.' });
    }

    // --- 3. Construção da Cláusula de Busca ---
    const propertyStatusFilter =
      showDeleted === 'false'
        ? { excludedAt: null }
        : showDeleted === 'only'
        ? { excludedAt: { not: null } }
        : {};

    const whereClause = {
      idUsuario: targetUserId,
      propriedade: propertyStatusFilter,
    };

    // --- 4. Execução das Consultas em uma Transação ---
    // A contagem e a busca dos dados são feitas em paralelo para otimizar a performance.
    const [totalRecords, userLinks] = await prisma.$transaction([
      prisma.usuariosPropriedades.count({ where: whereClause }),
      prisma.usuariosPropriedades.findMany({
        where: whereClause,
        include: {
          propriedade: {
            include: {
              fotos: {
                select: { documento: true },
                take: 1, // Pega apenas a primeira foto para servir como imagem de capa.
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // --- 5. Formatação dos Dados para a Resposta ---
    // Mapeia os resultados para um formato limpo, incluindo os novos campos de frações e saldo.
    const formattedProperties = userLinks.map((link) => ({
      id: link.propriedade.id,
      nomePropriedade: link.propriedade.nomePropriedade,
      tipo: link.propriedade.tipo,
      imagemPrincipal: link.propriedade.fotos[0]?.documento || null,
      permissao: link.permissao,
      numeroDeFracoes: link.numeroDeFracoes,
      saldoDiariasAtual: link.saldoDiariasAtual,
    }));

    // --- 6. Envio da Resposta Estruturada ---
    return res.status(200).json({
      success: true,
      message: 'Propriedades do usuário recuperadas com sucesso.',
      data: formattedProperties,
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
    logEvents(`ERRO ao buscar propriedades do usuário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar as propriedades.',
    });
  }
};