// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getUsuariosPropriedadesSchema = z.object({
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)).refine(val => val > 0, { message: "O limite deve ser um número positivo." }),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0, { message: "A página deve ser um número positivo." }),
  search: z.string().optional(),
});

const getUsuariosPropriedades = async (req: Request, res: Response) => {
  try {
    const { limit, page, search } = getUsuariosPropriedadesSchema.parse(req.query);

    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { usuario: { email: { contains: search, mode: 'insensitive' } } },
        { usuario: { nomeCompleto: { contains: search, mode: 'insensitive' } } },
        { propriedade: { nomePropriedade: { contains: search, mode: 'insensitive' } } },
      ];
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
          propriedade: {
            select: { id: true, nomePropriedade: true },
          },
        },
      }),
      prisma.usuariosPropriedades.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Vínculos recuperados com sucesso.",
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
    
    console.error("Erro no getUsuariosPropriedades:", error);

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

export { getUsuariosPropriedades };