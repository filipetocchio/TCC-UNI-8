import { Request, Response } from "express";
import { prisma } from "../../utils/prisma";
import { z } from "zod";

const getPropertyUsersSchema = z.object({
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

const getUserPropertiesPermission = async (req: Request, res: Response) => {
  try {
    const { id } = getPropertyUsersSchema.parse(req.params);
    const { limit, page, showDeleted } = getQueryParamsSchema.parse(req.query);

    const property = await prisma.propriedades.findUnique({
      where: { id },
    });

    if (!property) {
      return res.status(404).json({ error: "Propriedade não encontrada" });
    }

    const deletedFilter =
      showDeleted === "true"
        ? {} // Todos os registros
        : showDeleted === "only"
        ? { excludedAt: { not: null } }
        : { excludedAt: null };

    const totalRecords = await prisma.usuariosPropriedades.count({
      where: {
        idPropriedade: id,
        usuario: deletedFilter,
      },
    });

    const totalPages = Math.ceil(totalRecords / limit);
    const skip = (page - 1) * limit;

    const users = await prisma.usuariosPropriedades.findMany({
      where: {
        idPropriedade: id,
        usuario: deletedFilter,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
      skip,
      take: limit,
    });

    const formattedUsers = users.map((userProp) => ({
      idUsuario: userProp.usuario.id,
      nomeCompleto: userProp.usuario.nomeCompleto,
      email: userProp.usuario.email,
      permissao: userProp.permissao,
    }));

    return res.status(200).json({
      data: formattedUsers,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};

export { getUserPropertiesPermission };