// src/controllers/User/get.User.controller.ts
import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import { z } from "zod";

const getUserSchema = z.object({
  limit: z
    .string().optional().transform(val => (val ? parseInt(val, 10) : 10))
    .refine(val => val > 0, { message: "Limit must be a positive number." }),
  page: z
    .string().optional().transform(val => (val ? parseInt(val, 10) : 1))
    .refine(val => val > 0, { message: "Page must be a positive number." }),
  search: z.string().optional(),
  showDeleted: z.enum(["true", "false", "only"]).optional().default("false"),
});

const getUser = async (req: Request, res: Response) => {
  try {
    const { limit, page, search, showDeleted } = getUserSchema.parse(req.query);

    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { nomeCompleto: { contains: search, mode: "insensitive" } },
        { cpf: { contains: search, mode: "insensitive" } },
      ];
    }
    if (showDeleted === "false") where.excludedAt = null;
    else if (showDeleted === "only") where.excludedAt = { not: null };

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
          userPhoto: { select: { url: true } },  // adiciona foto
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Usuários recuperados com sucesso.",
      data: {
        users,
        pagination: { page, limit, total, totalPages },
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
    console.error("Erro no getUser:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor.",
      message: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
  }
};

export { getUser };
