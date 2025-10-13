// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Schema para validar os parâmetros da requisição.
 */
const getSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)),
  page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
});

/**
 * Busca e retorna uma lista paginada das próximas reservas de uma propriedade
 * (a partir da data atual).
 */
export const getUpcomingReservations = async (req: Request, res: Response) => {
  try {
    const { propertyId, limit, page } = getSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    const skip = (page - 1) * limit;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Define o início do dia para uma comparação precisa

    const where: Prisma.ReservaWhereInput = {
      idPropriedade: propertyId,
      status: { not: 'CANCELADA' },
      dataInicio: {
        gte: today, // gte = Greater Than or Equal (maior ou igual a)
      },
    };

    const [reservations, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          dataInicio: 'asc', // Ordena para mostrar as reservas mais próximas primeiro
        },
        select: {
          id: true,
          dataInicio: true,
          dataFim: true,
          status: true,
          usuario: {
            select: {
              id: true,
              nomeCompleto: true,
            },
          },
        },
      }),
      prisma.reserva.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Próximas reservas recuperadas com sucesso.',
      data: {
        reservations,
        pagination: { page, limit, total, totalPages },
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar as próximas reservas.' });
  }
};