// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Marcar Todos os Pagamentos de uma Despesa como Pagos
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que executa uma atualização
 * em massa, marcando todos os pagamentos de cotistas de uma despesa específica
 * como 'pagos' e atualizando o status da despesa principal para 'PAGO'.
 *
 * O processo é seguro e transacional:
 * 1.  Valida que o usuário autenticado é um 'proprietario_master'.
 * 2.  Atualiza todos os 'PagamentoCotista' da despesa para 'pago = true'.
 * 3.  Atualiza a 'Despesa' principal para 'status = PAGO'.
 * 4.  Dispara uma notificação em segundo plano.
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

// Schema para validar o ID da despesa nos parâmetros da rota.
const paramsSchema = z.object({
  expenseId: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0),
});

/**
 * Processa a atualização em massa de pagamentos para "pago".
 */
export const markAllPaymentsAsPaid = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { expenseId } = paramsSchema.parse(req.params);

    // --- 2. Execução da Lógica Transacional ---
    const { updatedExpense } = await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Busca da Despesa e Validação de Autorização (Master)
      const despesa = await tx.despesa.findUnique({
        where: { id: expenseId },
      });

      if (!despesa) {
        throw new Error("Despesa não encontrada.");
      }

      const isMaster = await tx.usuariosPropriedades.findFirst({
        where: {
          idUsuario: userId,
          idPropriedade: despesa.idPropriedade,
          permissao: 'proprietario_master',
        },
      });

      // Apenas um 'master' pode executar esta ação em massa.
      if (!isMaster) {
        throw new Error("Acesso negado. Apenas o proprietário master pode marcar todos como pagos.");
      }

      // 2.2. Atualização em Massa dos Pagamentos Individuais
      await tx.pagamentoCotista.updateMany({
        where: { idDespesa: expenseId },
        data: {
          pago: true,
          dataPagamento: new Date(),
        },
      });

      // 2.3. Atualização do Status da Despesa Principal
      const despesaAtualizada = await tx.despesa.update({
        where: { id: expenseId },
        data: {
          status: 'PAGO',
        },
      });

      return { updatedExpense: despesaAtualizada };
    });
    
    // --- 3. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade: updatedExpense.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' marcou todos os pagamentos da despesa '${updatedExpense.descricao}' como PAGOS.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para pagamento em massa: ${err.message}`, LOG_FILE);
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Todos os pagamentos foram marcados como pagos com sucesso.',
      data: updatedExpense,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao marcar todos os pagamentos como pagos: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor.' });
  }
};