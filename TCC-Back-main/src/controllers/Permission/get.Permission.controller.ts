import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getUsuariosPropriedadesSchema = z.object({
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)).refine(val => val > 0, { message: "Limit must be a positive number." }),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0, { message: "Page must be a positive number." }),
  search: z.string().optional(),
});

const getUsuariosPropriedades = async (req: Request, res: Response) => {
  try {
    const { limit, page, search } = getUsuariosPropriedadesSchema.parse(req.query);

    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { usuario: { email: { contains: search } } },
        { usuario: { nomeCompleto: { contains: search } } },
        { propriedade: { nomePropriedade: { contains: search } } },
      ];
    }

    const [vinculos, total] = await Promise.all([
      prisma.usuariosPropriedades.findMany({
        where,
        skip,
        take: limit,
        include: {
          usuario: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
            },
          },
          propriedade: {
            select: {
              id: true,
              nomePropriedade: true,
            },
          },
        },
      }),
      prisma.usuariosPropriedades.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const response = vinculos.map((vinculo) => ({
      id: vinculo.id,
      idUsuario: vinculo.idUsuario,
      idPropriedade: vinculo.idPropriedade,
      permissao: vinculo.permissao,
      dataVinculo: vinculo.dataVinculo,
      usuario: vinculo.usuario,
      propriedade: vinculo.propriedade,
    }));

    return res.status(200).json({
      success: true,
      message: "Vínculos recuperados com sucesso.",
      data: {
        vinculos: response,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        message: error.errors[0].message,
      });
    }
    console.error("Erro no getUsuariosPropriedades:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor.",
      message: error.message || "Erro interno do servidor.",
    });
  }
};

export { getUsuariosPropriedades };