// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';
import { differenceInDays, addDays } from 'date-fns';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

/**
 * Schema para validar o parâmetro de ID da reserva vindo da rota.
 */
const paramsSchema = z.object({
  reservationId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Cancela uma reserva, aplicando a lógica de penalidade por cancelamento tardio,
 * e notifica os membros sobre a ação.
 */
export const cancelReservation = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { reservationId } = paramsSchema.parse(req.params);

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Busca a reserva e as regras da propriedade associada.
      const reserva = await tx.reserva.findUnique({
        where: { id: reservationId },
        include: { propriedade: true },
      });

      if (!reserva) {
        throw new Error("Reserva não encontrada.");
      }
      if (reserva.status === 'CANCELADA' || reserva.status === 'CONCLUIDA') {
        throw new Error("Esta reserva já foi finalizada ou cancelada e não pode ser modificada.");
      }

      // 2. Validação de permissão: Apenas o dono da reserva ou um master podem cancelar.
      const isOwner = reserva.idUsuario === userId;
      const isMaster = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: userId, idPropriedade: reserva.idPropriedade, permissao: 'proprietario_master' },
      });

      if (!isOwner && !isMaster) {
        throw new Error("Acesso negado. Você não tem permissão para cancelar esta reserva.");
      }
      
      // 3. Lógica de Penalidade por Cancelamento Tardio.
      const diasParaReserva = differenceInDays(reserva.dataInicio, new Date());
      const prazoCancelamento = reserva.propriedade.prazoCancelamentoReserva;
      let penalidadeAplicada = false;

      if (diasParaReserva < prazoCancelamento) {
        // O cancelamento está fora do prazo, então uma penalidade é aplicada.
        await tx.penalidade.create({
          data: {
            idPropriedade: reserva.idPropriedade,
            idUsuario: reserva.idUsuario,
            motivo: `Cancelamento da reserva de ${reserva.dataInicio.toLocaleDateString('pt-BR')} fora do prazo de ${prazoCancelamento} dias.`,
            // Exemplo de penalidade: bloqueio por 30 dias a partir da data do cancelamento.
            dataFim: addDays(new Date(), 30),
          },
        });
        penalidadeAplicada = true;
      }

      // 4. Atualiza o status da reserva para CANCELADA.
      const reservaCancelada = await tx.reserva.update({
        where: { id: reservationId },
        data: { status: 'CANCELADA' },
      });

      return { reservaCancelada, penalidadeAplicada };
    });

    // 5. Cria a notificação para os outros membros.
    await createNotification({
      idPropriedade: result.reservaCancelada.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' cancelou a reserva para o período de ${result.reservaCancelada.dataInicio.toLocaleDateString('pt-BR')} a ${result.reservaCancelada.dataFim.toLocaleDateString('pt-BR')}.` + (result.penalidadeAplicada ? ' Uma penalidade por cancelamento tardio foi aplicada.' : ''),
    });

    return res.status(200).json({
      success: true,
      message: 'Reserva cancelada com sucesso.',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    return res.status(400).json({ success: false, message: errorMessage });
  }
};