// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Vínculos/Permissões (Administrativo)
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint administrativo que recupera uma lista
 * paginada de TODOS os vínculos entre usuários e propriedades no sistema.
 *
 * ####################################################################
 * #                                                                  #
 * #   N O T A   D E   S E G U R A N Ç A   E   R O T E A M E N T O    #
 * #                                                                  #
 * ####################################################################
 *
 * Este controlador expõe a estrutura de permissões de todo o sistema. É CRUCIAL
 * que a rota que o utiliza seja configurada com middlewares `protect` e `verifyRoles`
 * para garantir que apenas usuários com nível de **Administrador** possam acessá-la.
 *
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'permissionAccess.log';

// Schema para validar os parâmetros da query string (URL).
const getUsuariosPropriedadesSchema = z.object({
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
  search: z.string().optional(),
});

/**
 * Processa a requisição para buscar e listar os vínculos entre usuários e propriedades.
 */
export const getUsuariosPropriedades = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    // A autorização final (nível de acesso de admin) deve ser garantida na definição da rota.
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { limit, page, search } = getUsuariosPropriedadesSchema.parse(
      req.query
    );

    // --- 2. Construção Dinâmica da Cláusula de Busca ---
    const skip = (page - 1) * limit;
    const where: Prisma.UsuariosPropriedadesWhereInput = {};

    // A busca é case-sensitive (diferencia maiúsculas de minúsculas).
    if (search) {
      where.OR = [
        { usuario: { email: { contains: search } } },
        { usuario: { nomeCompleto: { contains: search } } },
        { propriedade: { nomePropriedade: { contains: search } } },
      ];
    }

    // --- 3. Execução das Consultas em uma Transação ---
    // A busca dos dados e a contagem total são executadas em uma transação
    // para otimizar a performance em um único round-trip ao banco.
    const [vinculos, total] = await prisma.$transaction([
      prisma.usuariosPropriedades.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          permissao: true,
          numeroDeFracoes: true,
          saldoDiariasAtual: true,
          usuario: {
            select: { id: true, nomeCompleto: true, email: true },
          },
          propriedade: {
            select: { id: true, nomePropriedade: true },
          },
        },
      }),
      prisma.usuariosPropriedades.count({ where }),
    ]);

    // --- 4. Cálculo da Paginação ---
    const totalPages = Math.ceil(total / limit);

    // --- 5. Envio da Resposta Estruturada ---
    return res.status(200).json({
      success: true,
      message: 'Vínculos de permissão recuperados com sucesso.',
      data: {
        vinculos,
        pagination: { page, limit, totalRecords: total, totalPages },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.issues[0].message });
    }

    // Registra qualquer erro inesperado para fins de monitoramento.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar vínculos de permissão: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar as permissões.',
    });
  }
};