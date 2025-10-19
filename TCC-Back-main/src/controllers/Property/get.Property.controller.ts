// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Propriedades do Usuário
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista de todas as
 * propriedades às quais o usuário autenticado está vinculado. A funcionalidade
 * é segura e otimizada, suportando:
 *
 * 1.  Paginação: Para lidar com usuários que possuem muitas propriedades.
 * 2.  Busca Textual: Permite uma busca por texto no nome e na cidade da propriedade.
 * 3.  Filtragem: Oferece opções para listar propriedades ativas, inativas ou todas.
 * 4.  Ordenação: Permite que os resultados sejam ordenados dinamicamente.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'property.log';

// Schema para validar os parâmetros da query string (URL).
const getPropertySchema = z.object({
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 10)).refine((v) => v > 0),
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)).refine((v) => v > 0),
  search: z.string().optional(),
  showDeleted: z.enum(['true', 'false', 'only']).optional().default('false'),
  sortBy: z.enum(['dataCadastro', 'valorEstimado', 'nomePropriedade']).optional().default('dataCadastro'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Processa a requisição para buscar e listar as propriedades de um usuário.
 */
export const getProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;
    const { limit, page, search, showDeleted, sortBy, sortOrder } =
      getPropertySchema.parse(req.query);

    // --- 2. Construção da Cláusula de Busca (Segurança e Filtros) ---
    const skip = (page - 1) * limit;
    
    // A cláusula base garante que apenas propriedades às quais o usuário
    // pertence sejam retornadas, aplicando o filtro de segurança principal.
    const where: Prisma.PropriedadesWhereInput = {
      usuarios: {
        some: {
          idUsuario: userId,
        },
      },
    };

    // Constrói um array de condições adicionais para os filtros de busca.
    const filterConditions: Prisma.PropriedadesWhereInput[] = [];
    if (search) {
      filterConditions.push({
        OR: [
          { nomePropriedade: { contains: search } },
          { enderecoCidade: { contains: search } },
        ],
      });
    }

    if (showDeleted === 'false') {
      filterConditions.push({ excludedAt: null });
    } else if (showDeleted === 'only') {
      filterConditions.push({ excludedAt: { not: null } });
    }

    // Adiciona as condições de filtro à cláusula principal, se existirem.
    if (filterConditions.length > 0) {
        where.AND = filterConditions;
    }

    const orderBy = { [sortBy]: sortOrder };

    // --- 3. Execução das Consultas Otimizadas ao Banco de Dados ---
    const [properties, total] = await Promise.all([
      prisma.propriedades.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          nomePropriedade: true,
          tipo: true,
          dataCadastro: true,
          // Pega apenas a primeira foto para servir como "foto de capa".
          fotos: { select: { id: true, documento: true }, take: 1 },
        },
      }),
      prisma.propriedades.count({ where }),
    ]);

    // --- 4. Formatação da Resposta e Construção de URLs ---
    const domain = `${req.protocol}://${req.get('host')}`;
    const formattedProperties = properties.map(prop => ({
        id: prop.id,
        nomePropriedade: prop.nomePropriedade,
        tipo: prop.tipo,
        dataCadastro: prop.dataCadastro,
        imagemPrincipal: prop.fotos[0]?.documento ? `${domain}${prop.fotos[0].documento}` : null,
    }));

    // --- 5. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Propriedades recuperadas com sucesso.',
      data: {
        properties: formattedProperties,
        pagination: { page, limit, totalRecords: total, totalPages },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar propriedades: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar as propriedades.',
    });
  }
};