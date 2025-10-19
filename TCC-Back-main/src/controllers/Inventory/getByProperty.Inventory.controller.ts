// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem Paginada de Itens de Inventário por Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista paginada
 * de todos os itens de inventário ativos associados a uma propriedade específica.
 *
 * O acesso a este endpoint é seguro, sendo restrito apenas a membros autenticados
 * da propriedade em questão. A resposta é paginada para garantir a performance
 * e a escalabilidade da aplicação.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'inventoryAccess.log';

// Schema para validar os parâmetros da rota (ID da propriedade) e da query (paginação).
const getInventorySchema = z.object({
  propertyId: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, {
    message: 'O ID da propriedade é inválido.',
  }),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)).refine((val) => val > 0),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)).refine((val) => val > 0),
});

/**
 * Processa a requisição para buscar os itens de inventário de uma propriedade.
 */
export const getInventoryByProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    // Garante que a requisição foi feita por um usuário autenticado.
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    // Valida e extrai os parâmetros da rota e da query em um único passo.
    const { propertyId, limit, page } = getInventorySchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
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
            message: 'Acesso negado. Você não tem permissão para visualizar o inventário desta propriedade.'
        });
    }

    // --- 3. Execução das Consultas Paginadas (Desempenho e Escalabilidade) ---
    // Calcula o deslocamento (offset) para a paginação.
    const skip = (page - 1) * limit;
    // Prepara a cláusula 'where' para as consultas.
    const where: Prisma.ItemInventarioWhereInput = {
      idPropriedade: propertyId,
      excludedAt: null, // Busca apenas itens de inventário que estão ativos.
    };

    // A contagem de registros e a busca dos dados são executadas em paralelo
    // dentro de uma transação para otimizar a performance da requisição.
    const [inventoryItems, total] = await prisma.$transaction([
      prisma.itemInventario.findMany({
        where,
        orderBy: {
          nome: 'asc', // Ordena os itens por nome para uma listagem consistente.
        },
        include: {
          // Inclui apenas as fotos do item que não foram marcadas como excluídas.
          fotos: {
            where: {
              excludedAt: null,
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.itemInventario.count({ where }),
    ]);

    // --- 4. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Os itens do inventário foram recuperados com sucesso.',
      data: inventoryItems,
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

    // Registra qualquer erro inesperado em um arquivo de log para análise posterior.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar inventário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar o inventário.',
    });
  }
};