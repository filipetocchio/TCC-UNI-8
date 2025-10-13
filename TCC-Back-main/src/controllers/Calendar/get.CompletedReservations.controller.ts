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
 * Busca e retorna uma lista paginada das reservas concluídas de uma propriedade.
 */
export const getCompletedReservations = async (req: Request, res: Response) => {
  try {
    const { propertyId, limit, page } = getSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    const skip = (page - 1) * limit;

    const where: Prisma.ReservaWhereInput = {
      idPropriedade: propertyId,
      status: 'CONCLUIDA', // Filtra apenas por reservas já finalizadas.
    };

    const [reservations, total] = await prisma.$transaction([
      prisma.reserva.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          dataFim: 'desc', // Ordena para mostrar as mais recentes primeiro.
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
      message: 'Reservas concluídas recuperadas com sucesso.',
      data: {
        reservations,
        pagination: { page, limit, total, totalPages },
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar as reservas concluídas.' });
  }
};