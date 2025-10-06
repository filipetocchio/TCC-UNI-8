// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validar os dados recebidos no corpo da requisição.
const markAsReadSchema = z.object({
  notificationIds: z.array(z.number().int().positive()).min(1, { message: "É necessário fornecer ao menos uma ID de notificação." }),
});

/**
 * Marca uma ou mais notificações como lidas para o usuário autenticado.
 */
export const markNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId } = req.user;
    const { notificationIds } = markAsReadSchema.parse(req.body);

    // Conecta o usuário atual à relação 'lidaPor' das notificações especificadas.
    // O Prisma gerencia a relação N-para-N, garantindo que não haja duplicatas.
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificacoesLidas: {
          connect: notificationIds.map(id => ({ id })),
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Notificações marcadas como lidas.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao marcar notificações." });
  }
};