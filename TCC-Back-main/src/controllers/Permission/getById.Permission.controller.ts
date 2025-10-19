// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Membros de uma Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista paginada de
 * todos os membros (usuários) associados a uma propriedade específica.
 *
 * O acesso a este endpoint é seguro, sendo restrito apenas a membros autenticados
 * da propriedade em questão, garantindo a privacidade dos dados dos participantes.
 * A funcionalidade suporta paginação e a filtragem de membros por status (ativos ou inativos).
 */
import { Request, Response } from 'express';
import { prisma } from '../../utils/prisma';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';
import { Prisma } from '@prisma/client';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'permissionAccess.log';

// --- Schemas de Validação ---

// Schema para validar os parâmetros da rota (ID da propriedade) e da query (paginação/busca).
const getUsersByPropertyIdSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'O ID da propriedade deve ser um número inteiro.')
    .transform(Number),
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
 * Processa a requisição para buscar e listar os membros de uma propriedade específica.
 */
export const getUsersByPropertyId = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    const { id: idPropriedade, limit, page, search } =
      getUsersByPropertyIdSchema.parse({
        id: req.params.id,
        ...req.query,
      });

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um membro da propriedade que está tentando acessar.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: idPropriedade,
            idUsuario: userId,
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Você não tem permissão para visualizar os membros desta propriedade.'
        });
    }

    // --- 3. Construção Dinâmica da Cláusula de Busca ---
    const skip = (page - 1) * limit;
    const where: Prisma.UsuariosPropriedadesWhereInput = { idPropriedade };

    if (search) {
      where.usuario = {
        OR: [
          { email: { contains: search } },
          { nomeCompleto: { contains: search } },
        ],
      };
    }

    // --- 4. Execução das Consultas em uma Transação ---
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
        },
      }),
      prisma.usuariosPropriedades.count({ where }),
    ]);

    // --- 5. Formatação dos Dados para a Resposta ---
    // Mapeia os resultados para um formato limpo, incluindo o ID do vínculo.
    const formattedData = vinculos.map((link) => ({
        idVinculo: link.id,
        idUsuario: link.usuario.id,
        nomeCompleto: link.usuario.nomeCompleto,
        email: link.usuario.email,
        permissao: link.permissao,
        numeroDeFracoes: link.numeroDeFracoes,
        saldoDiariasAtual: link.saldoDiariasAtual,
    }));

    // --- 6. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Membros da propriedade recuperados com sucesso.',
      data: formattedData,
      pagination: { page, limit, totalRecords: total, totalPages },
    });
  } catch (error: unknown) {
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