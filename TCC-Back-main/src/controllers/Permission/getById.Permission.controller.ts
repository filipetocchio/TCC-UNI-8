/**
 * @file getById.Permission.controller.ts
 * @description Controller para listar os vínculos de uma propriedade específica,
 * com base em seu ID, com suporte para paginação e busca de usuários.
 */
// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * @name getUsersByPropertyIdSchema
 * @description Define o schema de validação para os parâmetros da requisição.
 * Valida o ID da propriedade vindo da URL (params) e os parâmetros de query.
 */
const getUsersByPropertyIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'O ID da propriedade deve ser um número inteiro.').transform(Number),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)).refine(val => val > 0),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0),
  search: z.string().optional(),
});

/**
 * @function getUsersByPropertyId
 * @async
 * @description Manipula a requisição para buscar os usuários vinculados a uma propriedade específica.
 * @param {Request} req - O objeto de requisição do Express.
 * @param {Response} res - O objeto de resposta do Express.
 * @returns {Promise<Response>} Retorna uma resposta JSON com os dados ou uma mensagem de erro.
 */
const getUsersByPropertyId = async (req: Request, res: Response) => {
  try {
    const { id: idPropriedade, limit, page, search } = getUsersByPropertyIdSchema.parse({
      id: req.params.id,
      ...req.query,
    });

    const skip = (page - 1) * limit;

    // Garante que a propriedade existe antes de prosseguir
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
        message: error.errors[0].message,
      });
    }

    console.error("Erro em getUsersByPropertyId:", error);

    // Tratamento de erro seguro para o tipo 'unknown'
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
