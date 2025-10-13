// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * Schema para validar o parâmetro de ID da reserva vindo da rota.
 */
const paramsSchema = z.object({
  reservationId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Busca e retorna os detalhes completos de uma reserva específica, incluindo
 * o usuário, a propriedade e os checklists de inventário associados.
 */
export const getReservationById = async (req: Request, res: Response) => {
  try {
    const { reservationId } = paramsSchema.parse(req.params);

    const reservation = await prisma.reserva.findUnique({
      where: { id: reservationId },
      include: {
        // Inclui os dados do usuário que fez a reserva.
        usuario: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        // Inclui os dados da propriedade para referência.
        propriedade: {
          select: {
            id: true,
            nomePropriedade: true,
            horarioCheckin: true,
            horarioCheckout: true,
          },
        },
        // Inclui os checklists de check-in e check-out já realizados para esta reserva.
        checklist: {
          include: {
            // Para cada checklist, inclui os itens que foram verificados.
            itens: {
              include: {
                itemInventario: {
                  select: {
                    id: true,
                    nome: true,
                  },
                },
              },
            },
          },
          orderBy: {
            data: 'asc', // Ordena para que o check-in venha antes do check-out.
          },
        },
      },
    });

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reserva não encontrada.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Detalhes da reserva recuperados com sucesso.',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar a reserva.' });
  }
};