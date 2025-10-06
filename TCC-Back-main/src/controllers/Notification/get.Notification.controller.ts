// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validação do ID da propriedade vindo da rota.
const paramsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Busca e retorna todas as notificações associadas a uma propriedade específica.
 * As notificações são ordenadas da mais recente para a mais antiga.
 */
export const getNotificationsByProperty = async (req: Request, res: Response) => {
  try {
    const { propertyId } = paramsSchema.parse(req.params);

    const notifications = await prisma.notificacao.findMany({
      where: { idPropriedade: propertyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mensagem: true,
        createdAt: true,
        autor: {
          select: {
            id: true,
            nomeCompleto: true,
          },
        },
        lidaPor: {
          select: {
            id: true, // Retorna os IDs dos usuários que leram a notificação
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Notificações recuperadas com sucesso.',
      data: notifications,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    // Log detalhado para depuração no backend
    console.error("Erro detalhado ao buscar notificações:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao buscar notificações." });
  }
};