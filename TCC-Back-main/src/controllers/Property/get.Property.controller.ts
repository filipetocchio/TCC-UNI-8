// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getPropertySchema = z.object({
  limit: z.string().optional().transform(v => v ? parseInt(v, 10) : 10).refine(v => v > 0),
  page: z.string().optional().transform(v => v ? parseInt(v, 10) : 1).refine(v => v > 0),
  search: z.string().optional(),
  showDeleted: z.enum(['true','false','only']).optional().default('false'),
  sortBy: z.enum(['dataCadastro','valorEstimado','nomePropriedade']).optional().default('dataCadastro'),
  sortOrder: z.enum(['asc','desc']).optional().default('desc'),
});

/**
 * Lista todas as propriedades com filtros e paginação, garantindo que
 * todos os dados essenciais dos vínculos de usuário sejam incluídos.
 */
export const getProperty = async (req: Request, res: Response) => {
  try {
    const { limit, page, search, showDeleted, sortBy, sortOrder } = getPropertySchema.parse(req.query);

    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { nomePropriedade: { contains: search, mode: 'insensitive' } },
        { enderecoCidade:    { contains: search, mode: 'insensitive' } },
      ];
    }
    if (showDeleted === 'false')      where.excludedAt = null;
    else if (showDeleted === 'only')  where.excludedAt = { not: null };

    const orderBy = { [sortBy]: sortOrder };

    const [properties, total] = await Promise.all([
      prisma.propriedades.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          nomePropriedade: true,
          tipo: true,
          dataCadastro: true,
          
          usuarios: { 
            select: { 
              id: true,
              permissao: true,
              porcentagemCota: true,
              usuario: { 
                select: { 
                  id: true, 
                  nomeCompleto: true 
                } 
              } 
            } 
          },
          fotos: { select: { id: true, documento: true }, take: 1 },
        },
      }),
      prisma.propriedades.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    // Não é mais necessário formatar, pois o select já retorna a estrutura correta.
    return res.json({ 
      success: true, 
      message: 'Propriedades recuperadas com sucesso.', 
      data: { properties: properties, pagination: { page, limit, total, totalPages } } 
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: err.issues[0].message });
    }
    console.error('Error in getProperty:', err);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};