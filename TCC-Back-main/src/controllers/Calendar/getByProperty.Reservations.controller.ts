// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Schema para validar os parâmetros da requisição para buscar reservas.
 */
const getReservationsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  startDate: z.string().datetime({ message: "A data de início é inválida." }),
  endDate: z.string().datetime({ message: "A data de fim é inválida." }),
});

/**
 * Busca e retorna todas as reservas de uma propriedade que ocorrem
 * dentro de um intervalo de datas especificado.
 */
export const getReservationsByProperty = async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate } = getReservationsSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    const dataInicio = new Date(startDate);
    const dataFim = new Date(endDate);

    if (dataFim <= dataInicio) {
        return res.status(400).json({ success: false, message: "A data de fim deve ser posterior à data de início." });
    }

    // A cláusula 'where' busca por qualquer reserva que tenha intersecção com o período solicitado.
    const where: Prisma.ReservaWhereInput = {
        idPropriedade: propertyId,
        status: { not: 'CANCELADA' },
        AND: [
            { dataInicio: { lt: dataFim } },    // A reserva existente começa antes que o período de busca termine
            { dataFim: { gt: dataInicio } }, // E a reserva existente termina depois que o período de busca começa
        ],
    };

    const reservations = await prisma.reserva.findMany({
      where,
      orderBy: {
        dataInicio: 'asc',
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
    });

    return res.status(200).json({
      success: true,
      message: 'Reservas recuperadas com sucesso.',
      data: reservations,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar as reservas.' });
  }
};