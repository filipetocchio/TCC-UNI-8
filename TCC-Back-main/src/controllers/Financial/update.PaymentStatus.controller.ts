// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

const updatePaymentSchema = z.object({
  paymentId: z.string().transform(val => parseInt(val, 10)),
  pago: z.boolean(),
});

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { paymentId, pago } = updatePaymentSchema.parse({
      ...req.params,
      ...req.body,
    });

    let idPropriedadeParaNotificacao: number | null = null;
    let nomeDaDespesa: string = '';

    const updatedPayment = await prisma.$transaction(async (tx: TransactionClient) => {
      const pagamento = await tx.pagamentoCotista.findUnique({
        where: { id: paymentId },
        include: { despesa: true }, 
      });

      if (!pagamento) {
        throw new Error("Registro de pagamento não encontrado.");
      }
      
      idPropriedadeParaNotificacao = pagamento.despesa.idPropriedade;
      nomeDaDespesa = pagamento.despesa.descricao;

      const isOwner = pagamento.idCotista === userId;
      const isMaster = await tx.usuariosPropriedades.findFirst({
        where: {
          idUsuario: userId,
          idPropriedade: pagamento.despesa.idPropriedade,
          permissao: 'proprietario_master',
        },
      });

      if (!isOwner && !isMaster) {
        throw new Error("Acesso negado. Você não tem permissão para alterar este pagamento.");
      }

      const pagamentoAtualizado = await tx.pagamentoCotista.update({
        where: { id: paymentId },
        data: {
          pago,
          dataPagamento: pago ? new Date() : null,
        },
      });

      const todosPagamentos = await tx.pagamentoCotista.findMany({
        where: { idDespesa: pagamento.idDespesa },
      });

      const todosPagos = todosPagamentos.every(p => p.pago);
      const algunsPagos = todosPagamentos.some(p => p.pago) && !todosPagos;

      let novoStatusDespesa = pagamento.despesa.status;
      if (todosPagos) {
        novoStatusDespesa = 'PAGO';
      } else if (algunsPagos) {
        novoStatusDespesa = 'PARCIALMENTE_PAGO';
      } else {
        novoStatusDespesa = 'PENDENTE';
      }
      
      if (novoStatusDespesa !== pagamento.despesa.status) {
        await tx.despesa.update({
          where: { id: pagamento.idDespesa },
          data: { status: novoStatusDespesa },
        });
      }

      return pagamentoAtualizado;
    });

    if (idPropriedadeParaNotificacao) {
        await createNotification({
          idPropriedade: idPropriedadeParaNotificacao,
          idAutor: userId,
          mensagem: `O usuário '${userName}' marcou um pagamento da despesa '${nomeDaDespesa}' como '${updatedPayment.pago ? 'Pago' : 'Pendente'}'.`,
        });
    }

    return res.status(200).json({
      success: true,
      message: 'Status do pagamento atualizado com sucesso.',
      data: updatedPayment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    return res.status(500).json({ success: false, message: errorMessage });
  }
};