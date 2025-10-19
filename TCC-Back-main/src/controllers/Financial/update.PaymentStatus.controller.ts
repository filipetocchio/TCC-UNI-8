// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Status de Pagamento
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que atualiza o status de um
 * pagamento individual de um cotista (marcando-o como pago ou pendente).
 * A operação é segura, transacional e otimizada para performance.
 *
 * O processo é responsável por:
 * 1.  Validar que o usuário autenticado é o dono do pagamento ou um 'proprietario_master'.
 * 2.  Atualizar o status do pagamento individual.
 * 3.  Recalcular e atualizar o status geral da despesa associada (ex: PAGO, PARCIALMENTE_PAGO).
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'financial.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Schema para validar os dados da requisição.
const updatePaymentSchema = z.object({
  paymentId: z.string().transform(val => parseInt(val, 10)),
  pago: z.boolean(),
});

/**
 * Processa a atualização do status de um pagamento individual.
 */
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { paymentId, pago } = updatePaymentSchema.parse({
      paymentId: req.params.paymentId,
      ...req.body,
    });

    // --- 2. Execução da Lógica Transacional ---
    // A transação retorna um objeto com os dados necessários para a notificação e a resposta.
    const { updatedPayment, notificationPayload } = await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Busca do Pagamento e Validação de Autorização
      const pagamento = await tx.pagamentoCotista.findUnique({
        where: { id: paymentId },
        include: { despesa: true }, 
      });
      if (!pagamento) throw new Error("Registro de pagamento não encontrado.");

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

      // 2.2. Atualização do Pagamento Individual
      const pagamentoAtualizado = await tx.pagamentoCotista.update({
        where: { id: paymentId },
        data: {
          pago,
          dataPagamento: pago ? new Date() : null,
        },
      });

      // 2.3. Recálculo e Atualização do Status da Despesa Principal
      const todosPagamentos = await tx.pagamentoCotista.findMany({
        where: { idDespesa: pagamento.idDespesa },
      });

      const todosPagos = todosPagamentos.every(p => p.pago);
      const algunsPagos = todosPagamentos.some(p => p.pago) && !todosPagos;

      let novoStatusDespesa: Prisma.DespesaUpdateInput['status'] = pagamento.despesa.status;
      if (todosPagos) novoStatusDespesa = 'PAGO';
      else if (algunsPagos) novoStatusDespesa = 'PARCIALMENTE_PAGO';
      else novoStatusDespesa = 'PENDENTE';
      
      if (novoStatusDespesa !== pagamento.despesa.status) {
        await tx.despesa.update({
          where: { id: pagamento.idDespesa },
          data: { status: novoStatusDespesa },
        });
      }

      // Retorna os dados necessários para as etapas seguintes.
      return {
          updatedPayment: pagamentoAtualizado,
          notificationPayload: {
              idPropriedade: pagamento.despesa.idPropriedade,
              nomeDaDespesa: pagamento.despesa.descricao
          }
      };
    });
    
    // --- 3. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade: notificationPayload.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' marcou um pagamento da despesa '${notificationPayload.nomeDaDespesa}' como '${updatedPayment.pago ? 'Pago' : 'Pendente'}'.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para status de pagamento: ${err.message}`, LOG_FILE);
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Status do pagamento atualizado com sucesso.',
      data: updatedPayment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao atualizar status de pagamento: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao atualizar o pagamento.' });
  }
};