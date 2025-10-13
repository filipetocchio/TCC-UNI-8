// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

/**
 * Schema para validar os dados do checklist de cada item.
 */
const itemChecklistSchema = z.object({
  idItemInventario: z.number().int(),
  estadoConservacao: z.enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO']),
  observacao: z.string().optional().nullable(),
  // fotoUrl: z.string().url().optional().nullable(), // Para uma V2, quando implementarmos o upload de fotos de problemas
});

/**
 * Schema para validar o corpo da requisição de check-in.
 */
const checkinSchema = z.object({
  reservationId: z.number().int(),
  observacoes: z.string().optional().nullable(),
  itens: z.array(itemChecklistSchema).min(1, { message: "O checklist de itens não pode estar vazio." }),
});

/**
 * Registra o check-in de uma reserva, salvando o estado do inventário
 * conforme verificado pelo usuário e notificando sobre a ação.
 */
export const performCheckin = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { reservationId, observacoes, itens } = checkinSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Valida a reserva e as permissões.
      const reserva = await tx.reserva.findUnique({
        where: { id: reservationId },
        include: { propriedade: { select: { nomePropriedade: true } } },
      });

      if (!reserva) {
        throw new Error("Reserva não encontrada.");
      }
      if (reserva.idUsuario !== userId) {
        throw new Error("Acesso negado. Você só pode fazer o check-in para suas próprias reservas.");
      }
      if (reserva.status !== 'CONFIRMADA') {
        throw new Error(`Não é possível fazer check-in para uma reserva com status '${reserva.status}'.`);
      }
      const existingCheckin = await tx.checklistInventario.findFirst({
        where: { idReserva: reservationId, tipo: 'CHECKIN' },
      });
      if (existingCheckin) {
        throw new Error("O check-in para esta reserva já foi realizado.");
      }

      // 2. Cria o registro principal do Checklist.
      const checklist = await tx.checklistInventario.create({
        data: {
          idReserva: reservationId,
          idUsuario: userId,
          tipo: 'CHECKIN',
          observacoes,
        },
      });

      // 3. Cria os registros de cada item verificado no checklist.
      await tx.itemChecklist.createMany({
        data: itens.map(item => ({
          idChecklist: checklist.id,
          idItemInventario: item.idItemInventario,
          estadoConservacao: item.estadoConservacao,
          observacao: item.observacao,
        })),
      });

      return { checklist, propertyName: reserva.propriedade.nomePropriedade };
    });

    // 4. Cria a notificação para os outros membros.
    await createNotification({
      idPropriedade: result.checklist.idReserva, 
      idAutor: userId,
      mensagem: `O usuário '${userName}' realizou o check-in na propriedade '${result.propertyName}'.`,
    });

    return res.status(201).json({
      success: true,
      message: 'Check-in realizado com sucesso!',
      data: result.checklist,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    return res.status(400).json({ success: false, message: errorMessage });
  }
};