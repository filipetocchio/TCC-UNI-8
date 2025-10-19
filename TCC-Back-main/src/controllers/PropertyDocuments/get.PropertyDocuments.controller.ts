// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem Paginada de TODOS os Documentos de Propriedades
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint administrativo que recupera uma
 * lista paginada de TODOS os documentos de TODAS as propriedades do sistema.
 *
 * ####################################################################
 * #                                                                  #
 * #   N O T A   D E   S E G U R A N Ç A   E   R O T E A M E N T O    #
 * #                                                                  #
 * ####################################################################
 *
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'documentAccess.log';

// Schema para validar os parâmetros de paginação da query string.
const getDocumentsSchema = z.object({
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
 * Processa a requisição para buscar todos os documentos de propriedades com paginação.
 */
export const getPropertyDocuments = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    // A autorização final (nível de acesso de admin) deve ser garantida na definição da rota.
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário não autenticado.' });
    }

    const { limit, page } = getDocumentsSchema.parse(req.query);

    // --- 2. Execução das Consultas Paginadas em Transação ---
    const skip = (page - 1) * limit;
    const where: Prisma.DocumentoPropriedadeWhereInput = {}; // Filtro vazio para buscar todos.

    const [totalRecords, documentos] = await prisma.$transaction([
      prisma.documentoPropriedade.count({ where }),
      prisma.documentoPropriedade.findMany({
        where,
        include: {
          propriedade: {
            select: {
              id: true,
              nomePropriedade: true,
            },
          },
        },
        skip,
        take: limit,
      }),
    ]);

    // --- 3. Construção das URLs Absolutas dos Documentos ---
    // Adiciona o domínio do servidor ao caminho do arquivo para criar uma URL completa.
    const domain = `${req.protocol}://${req.get('host')}`;
    const documentosComUrlCompleta = documentos.map(doc => ({
      ...doc,
      documento: `${domain}${doc.documento}`,
    }));

    // --- 4. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
      success: true,
      message:
        documentos.length > 0
          ? 'Documentos recuperados com sucesso.'
          : 'Nenhum documento encontrado.',
      data: documentosComUrlCompleta,
      pagination: {
        totalRecords,
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

    // Em produção, este erro deve ser registrado em um sistema de monitoramento.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar todos os documentos: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar os documentos.',
    });
  }
};