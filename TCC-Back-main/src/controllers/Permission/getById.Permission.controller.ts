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

const getUsersByPropertyId = async (req: Request, res: Response) => {
  try {
    const { id: idPropriedade, limit, page, search } = getUsersByPropertyIdSchema.parse({
      id: req.params.id,
      ...req.query,
    });
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
    return res.status(500).json({ success: false, message: "Erro interno do servidor.", error: errorMessage });
  }
};

export { getUsersByPropertyId as getByIDsuariosPropriedades };