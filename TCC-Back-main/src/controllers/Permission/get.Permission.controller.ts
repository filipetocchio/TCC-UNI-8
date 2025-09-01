/**
 * @file get.Permission.controller.ts
 * @description Controller para listar os vínculos entre usuários e propriedades,
 * com suporte para paginação e busca.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * @name getUsuariosPropriedadesSchema
 * @description Define o schema de validação para os parâmetros de query (limit, page, search).
 * Utiliza o Zod para sanitizar e validar os dados de entrada.
 */
const getUsuariosPropriedadesSchema = z.object({
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)).refine(val => val > 0, { message: "O limite deve ser um número positivo." }),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)).refine(val => val > 0, { message: "A página deve ser um número positivo." }),
  search: z.string().optional(),
});

/**
 * @function getUsuariosPropriedades
 * @async
 * @description Manipula a requisição para buscar e retornar uma lista paginada de vínculos.
 * @param {Request} req - O objeto de requisição do Express.
 * @param {Response} res - O objeto de resposta do Express.
 * @returns {Promise<Response>} Retorna uma resposta JSON com os dados ou uma mensagem de erro.
 */
const getUsuariosPropriedades = async (req: Request, res: Response) => {
  try {
    const { limit, page, search } = getUsuariosPropriedadesSchema.parse(req.query);

    const skip = (page - 1) * limit;
    const where: any = {}; // O tipo 'any' é usado aqui para construção dinâmica da query.

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
        vinculos: vinculos, // O map anterior era redundante, o prisma já retorna o formato desejado.
        pagination: { page, limit, total, totalPages },
      },
    });
  } catch (error) { // Por padrão, 'error' é do tipo 'unknown' no TypeScript estrito.
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    
    console.error("Erro no getUsuariosPropriedades:", error);

    // Verificação de tipo para tratar o erro 'unknown' de forma segura.
    // Checamos se o erro é uma instância da classe 'Error' padrão do JS
    // para podermos acessar sua propriedade '.message' com segurança.
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
