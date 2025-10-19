// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Cancelamento de Reserva
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que cancela uma reserva. O processo
 * é seguro, transacional e otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar que o usuário autenticado é o dono da reserva ou um 'proprietario_master'.
 * 2.  Verificar se o cancelamento está fora do prazo e, se estiver, aplicar uma penalidade.
 * 3.  Devolver os dias da reserva cancelada ao saldo de diárias do cotista.
 * 4.  Atualizar o status da reserva para 'CANCELADA'.
 * 5.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';
import { differenceInDays, addDays } from 'date-fns';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'calendar.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Schema para validar o ID da reserva nos parâmetros da rota.
const paramsSchema = z.object({
  reservationId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Cancela uma reserva, aplicando a lógica de penalidade e devolução de saldo.
 */
export const cancelReservation = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { reservationId } = paramsSchema.parse(req.params);

    // --- 2. Execução da Lógica Transacional de Cancelamento ---
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Busca da Reserva e Validação de Autorização
      const reserva = await tx.reserva.findUnique({
        where: { id: reservationId },
        include: { propriedade: true },
      });

      if (!reserva) throw new Error("Reserva não encontrada.");
      if (reserva.status === 'CANCELADA' || reserva.status === 'CONCLUIDA') {
        throw new Error("Esta reserva já foi finalizada ou cancelada.");
      }

      const isOwner = reserva.idUsuario === userId;
      const isMaster = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: userId, idPropriedade: reserva.idPropriedade, permissao: 'proprietario_master' },
      });
      if (!isOwner && !isMaster) {
        throw new Error("Acesso negado. Você não tem permissão para cancelar esta reserva.");
      }
      
      // 2.2. Lógica de Penalidade por Cancelamento Tardio
      const diasParaReserva = differenceInDays(reserva.dataInicio, new Date());
      const prazoCancelamento = reserva.propriedade.prazoCancelamentoReserva;
      let penalidadeAplicada = false;

      if (diasParaReserva < prazoCancelamento) {
        await tx.penalidade.create({
          data: {
            idPropriedade: reserva.idPropriedade,
            idUsuario: reserva.idUsuario,
            motivo: `Cancelamento da reserva de ${reserva.dataInicio.toLocaleDateString('pt-BR')} fora do prazo de ${prazoCancelamento} dias.`,
            dataFim: addDays(new Date(), 30), // Exemplo de penalidade: bloqueio por 30 dias.
          },
        });
        penalidadeAplicada = true;
      }

      // 2.3. Devolução do Saldo de Diárias (Novo Fluxo)
      const durationInDays = differenceInDays(reserva.dataFim, reserva.dataInicio);
      if (durationInDays > 0) {
          const userLink = await tx.usuariosPropriedades.findFirst({
              where: { idUsuario: reserva.idUsuario, idPropriedade: reserva.idPropriedade }
          });
          if (userLink) {
              await tx.usuariosPropriedades.update({
                  where: { id: userLink.id },
                  data: { saldoDiariasAtual: { increment: durationInDays } }
              });
          }
      }

      // 2.4. Atualiza o status da reserva para CANCELADA.
      const reservaCancelada = await tx.reserva.update({
        where: { id: reservationId },
        data: { status: 'CANCELADA' },
      });

      return { reservaCancelada, penalidadeAplicada };
    });

    // --- 3. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade: result.reservaCancelada.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' cancelou a reserva para o período de ${result.reservaCancelada.dataInicio.toLocaleDateString('pt-BR')} a ${result.reservaCancelada.dataFim.toLocaleDateString('pt-BR')}.` + (result.penalidadeAplicada ? ' Uma penalidade por cancelamento tardio foi aplicada.' : ''),
    }).catch(err => {
      logEvents(`Falha ao criar notificação para cancelamento de reserva: ${err.message}`, LOG_FILE);
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Reserva cancelada com sucesso.',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
    }

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao cancelar reserva: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor.' });
  }
};