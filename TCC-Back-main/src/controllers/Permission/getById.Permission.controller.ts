// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const getUsersByPropertyIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'O ID da propriedade deve ser um número inteiro.').transform(Number),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)).refine(val => val > 0),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0),
  search: z.string().optional(),
});

/**
 * Busca e retorna uma lista paginada de todos os membros (usuários)
 * associados a uma propriedade específica.
 * @param req - O objeto de requisição do Express.
 * @param res - O objeto de resposta do Express.
 */
export const getUsersByPropertyId = async (req: Request, res: Response) => {
  try {
    const { id: idPropriedade, limit, page, search } = getUsersByPropertyIdSchema.parse({
      id: req.params.id,
      ...req.query,
    });
    const skip = (page - 1) * limit;

    const where: Prisma.UsuariosPropriedadesWhereInput = { idPropriedade };
    
    // Filtro de busca para o nome ou e-mail do usuário.
    // A propriedade 'mode: insensitive' foi removida para garantir
    // compatibilidade com o banco de dados SQLite.
    if (search) {
      where.usuario = {
        OR: [
          { email: { contains: search } },
          { nomeCompleto: { contains: search } },
        ],
      };
    }

    const [vinculos, total] = await prisma.$transaction([
      prisma.usuariosPropriedades.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          permissao: true,
          porcentagemCota: true,
          usuario: {
            select: { id: true, nomeCompleto: true, email: true },
          },
        },
      }),
      prisma.usuariosPropriedades.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Membros da propriedade recuperados com sucesso.",
      data: {
        vinculos,
        pagination: { page, limit, total, totalPages },
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    // O erro é tratado como 'unknown' para segurança de tipos.
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
    console.error("Erro ao buscar membros da propriedade:", errorMessage);
    
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};