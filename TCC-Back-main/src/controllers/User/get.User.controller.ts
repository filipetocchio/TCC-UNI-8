// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem Paginada de Usuários (Administrativo)
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint administrativo que recupera uma
 * lista paginada de TODOS os usuários do sistema, com suporte a busca e filtros.
 *
 * ####################################################################
 * #                                                                  #
 * #   N O T A   D E   S E G U R A N Ç A   E   R O T E A M E N T O    #
 * #                                                                  #
 * ####################################################################
 *
 * Este controlador expõe dados sensíveis de todos os usuários. É CRUCIAL que a
 * rota que o utiliza seja configurada com middlewares `protect` e `verifyRoles`
 * para garantir que apenas usuários com nível de **Administrador** possam acessá-la.
 *
 *
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'userAccess.log';

// Schema para validar os parâmetros da query string (URL).
const getUserSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0, { message: 'O limite deve ser um número positivo.' }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, { message: 'A página deve ser um número positivo.' }),
  search: z.string().optional(),
  showDeleted: z.enum(['true', 'false', 'only']).optional().default('false'),
});

/**
 * Processa a requisição para buscar e listar usuários com filtros e paginação.
 */
export const getUser = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    // A autorização final (nível de acesso de admin) deve ser garantida na definição da rota.
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { limit, page, search, showDeleted } = getUserSchema.parse(req.query);

    // --- 2. Construção Dinâmica da Cláusula 'where' ---
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { nomeCompleto: { contains: search } },
        { cpf: { contains: search } },
      ];
    }

    if (showDeleted === 'false') {
      where.excludedAt = null;
    } else if (showDeleted === 'only') {
      where.excludedAt = { not: null };
    }

    // --- 3. Execução das Consultas ao Banco de Dados ---
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          cpf: true,
          telefone: true,
          dataCadastro: true,
          userPhoto: { select: { url: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // --- 4. Construção das URLs Absolutas para as Fotos ---
    const domain = `${req.protocol}://${req.get('host')}`;
    const usersWithFullUrl = users.map(user => {
      if (user.userPhoto?.url) {
        return {
          ...user,
          userPhoto: {
            url: `${domain}${user.userPhoto.url}`,
          },
        };
      }
      return user;
    });
    
    // --- 5. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Usuários recuperados com sucesso.',
      data: {
        users: usersWithFullUrl,
        pagination: { page, limit, totalRecords: total, totalPages },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar usuários: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar os usuários.',
    });
  }
};