// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

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

    const propriedade = await prisma.propriedades.findUnique({
      where: { id: idPropriedade },
    });
    if (!propriedade) {
      return res.status(404).json({
        success: false,
        message: `Propriedade com ID ${idPropriedade} não encontrada.`,
      });
    }

    const where: any = { idPropriedade };
    if (search) {
      where.usuario = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { nomeCompleto: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [vinculos, total] = await Promise.all([
      prisma.usuariosPropriedades.findMany({
        where,
        skip,
        take: limit,
        include: {
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
      message: "Vínculos da propriedade recuperados com sucesso.",
      data: {
        vinculos: vinculos,
        pagination: { page, limit, total, totalPages },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    console.error("Erro em getUsersByPropertyId:", error);

    let errorMessage = "Ocorreu um erro interno no servidor.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return res.status(500).json({
      success: false,
      message: errorMessage,
    });
  }
};

export { getUsersByPropertyId as getByIDsuariosPropriedades };