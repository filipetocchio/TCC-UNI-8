// Todos direitos autorais reservados pelo QOTA.

import { Request, Response } from "express";
import { prisma } from "../../utils/prisma";
import { z } from "zod";

const getUserPropertiesSchema = z.object({
  id: z.string().transform((val) => parseInt(val)).refine((val) => val > 0, {
    message: "ID deve ser um número positivo",
  }),
});

const getQueryParamsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10))
    .refine((val) => val > 0, {
      message: "Limit deve ser um número positivo",
    }),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1))
    .refine((val) => val > 0, {
      message: "Page deve ser um número positivo",
    }),
  showDeleted: z.enum(["true", "false", "only"]).optional().default("false"),
});

export const getPropertyUsersPermission = async (req: Request, res: Response) => {
  try {
    const { id } = getUserPropertiesSchema.parse(req.params);
    const { limit, page, showDeleted } = getQueryParamsSchema.parse(req.query);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const deletedFilter =
      showDeleted === "true"
        ? {}
        : showDeleted === "only"
        ? { excludedAt: { not: null } }
        : { excludedAt: null };

    const totalRecords = await prisma.usuariosPropriedades.count({
      where: {
        idUsuario: id,
        propriedade: deletedFilter,
      },
    });

    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const properties = await prisma.usuariosPropriedades.findMany({
      where: {
        idUsuario: id,
        propriedade: deletedFilter,
      },
      include: {
        propriedade: {
          include: {
            fotos: {
              select: { documento: true },
              take: 1,
            },
          },
        },
      },
      skip,
      take: limit,
    });

    const formattedProperties = properties.map((prop) => ({
      id: prop.propriedade.id,
      nomePropriedade: prop.propriedade.nomePropriedade,
      imagemPrincipal: prop.propriedade.fotos[0]?.documento || null,
      tipo: prop.propriedade.tipo,
      cep: prop.propriedade.enderecoCep || null,
      permissao: prop.permissao,
    }));

    return res.status(200).json({
      data: formattedProperties,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    console.error(error);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};