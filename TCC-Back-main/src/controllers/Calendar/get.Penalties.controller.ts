// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * Schema para validar o parâmetro de ID da propriedade vindo da rota.
 */
const paramsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Busca e retorna todas as penalidades ativas para uma propriedade específica.
 * Uma penalidade é considerada ativa se sua data de fim for no futuro.
 */
export const getPenaltiesByProperty = async (req: Request, res: Response) => {
  try {
    const { propertyId } = paramsSchema.parse(req.params);

    const penalties = await prisma.penalidade.findMany({
      where: {
        idPropriedade: propertyId,
        // Garante que estamos buscando apenas as penalidades que ainda estão em vigor.
        dataFim: {
          gte: new Date(), // gte = Greater Than or Equal (maior ou igual a)
        },
      },
      orderBy: {
        createdAt: 'desc', // Exibe as penalidades mais recentes primeiro.
      },
      select: {
        id: true,
        motivo: true,
        dataFim: true,
        createdAt: true,
        usuario: {
          // Inclui o nome do usuário que recebeu a penalidade.
          select: {
            id: true,
            nomeCompleto: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Penalidades recuperadas com sucesso.',
      data: penalties,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar penalidades.' });
  }
};