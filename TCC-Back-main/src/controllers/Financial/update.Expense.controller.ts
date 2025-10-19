// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Despesa
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que atualiza uma despesa existente.
 * A operação é segura, transacional e otimizada para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é o criador ou 'proprietario_master').
 * 2.  Atualizar os dados da despesa.
 * 3.  Se o valor da despesa for alterado, recalcular e atualizar atomicamente o
 * rateio de pagamentos para todos os cotistas com base em suas frações.
 * 4.  Gerenciar a substituição de arquivos de comprovante, excluindo os antigos.
 * 5.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'financial.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Schema para validar os dados do corpo da requisição para atualizar uma despesa.
const updateExpenseSchema = z.object({
  descricao: z.string().min(1, { message: "A descrição é obrigatória." }),
  valor: z.coerce.number().positive({ message: "O valor deve ser um número positivo." }),
  dataVencimento: z.string().datetime({ message: "Formato de data inválido." }),
  categoria: z.string().min(1, { message: "A categoria é obrigatória." }),
  observacao: z.string().optional(),
  recorrente: z.string().transform(val => val === 'true'),
  frequencia: z.string().optional(),
  diaRecorrencia: z.coerce.number().int().optional(),
});

/**
 * Processa a atualização de uma despesa existente.
 */
export const updateExpense = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { expenseId } = req.params;
    const validatedData = updateExpenseSchema.parse(req.body);

    // --- 2. Busca e Validação da Despesa Original ---
    const despesaOriginal = await prisma.despesa.findUnique({
      where: { id: Number(expenseId) },
      include: { propriedade: true },
    });

    if (!despesaOriginal) {
      return res.status(404).json({ success: false, message: "Despesa não encontrada." });
    }

    // --- 3. Verificação de Autorização (Segurança) ---
    const userPermission = await prisma.usuariosPropriedades.findFirst({
      where: { idUsuario: userId, idPropriedade: despesaOriginal.idPropriedade }
    });

    const isMaster = userPermission?.permissao === 'proprietario_master';
    const isAuthor = despesaOriginal.criadoPorId === userId;

    if (!isAuthor && !isMaster) {
      return res.status(403).json({ success: false, message: "Acesso negado. Você não tem permissão para editar esta despesa." });
    }
    
    // --- 4. Execução da Lógica Transacional de Atualização ---
    const updatedExpense = await prisma.$transaction(async (tx: TransactionClient) => {
      // 4.1. Atualiza os dados principais da despesa
      const novosComprovantes = req.files && Array.isArray(req.files) && req.files.length > 0
          ? (req.files as Express.Multer.File[]).map(file => `/uploads/invoices/${file.filename}`).join(',')
          : undefined;

      const despesaAtualizada = await tx.despesa.update({
        where: { id: Number(expenseId) },
        data: {
          ...validatedData,
          urlComprovante: novosComprovantes,
          dataVencimento: new Date(validatedData.dataVencimento),
        },
      });

      // 4.2. Recalcula o rateio apenas se o valor da despesa foi alterado
      if (validatedData.valor !== despesaOriginal.valor) {
        const cotistas = await tx.usuariosPropriedades.findMany({
          where: { idPropriedade: despesaOriginal.idPropriedade, numeroDeFracoes: { gt: 0 } },
        });

        if (cotistas.length > 0) {
            const { totalFracoes } = despesaOriginal.propriedade;
            if (totalFracoes === 0) throw new Error("A propriedade não possui um total de frações definido para o rateio.");

            let valorTotalDistribuido = 0;
            const pagamentosParaAtualizar = cotistas.map(cotista => {
              const proporcao = cotista.numeroDeFracoes / totalFracoes;
              const novoValorDevido = parseFloat((validatedData.valor * proporcao).toFixed(2));
              valorTotalDistribuido += novoValorDevido;
              return { idCotista: cotista.idUsuario, novoValorDevido };
            });

            const diferenca = parseFloat((validatedData.valor - valorTotalDistribuido).toFixed(2));
            if (diferenca !== 0) {
              const master = cotistas.find(c => c.permissao === 'proprietario_master') || cotistas[0];
              const pagamentoDoMaster = pagamentosParaAtualizar.find(p => p.idCotista === master.idUsuario);
              if (pagamentoDoMaster) {
                pagamentoDoMaster.novoValorDevido = parseFloat((pagamentoDoMaster.novoValorDevido + diferenca).toFixed(2));
              }
            }
            
            // Executa todas as atualizações de pagamento em paralelo (Desempenho)
            const updatePromises = pagamentosParaAtualizar.map(p => 
              tx.pagamentoCotista.updateMany({
                where: { idDespesa: despesaAtualizada.id, idCotista: p.idCotista },
                data: { valorDevido: p.novoValorDevido },
              })
            );
            await Promise.all(updatePromises);
        }
      }

      return despesaAtualizada;
    });

    // --- 5. Gerenciamento de Arquivos Antigos (Pós-Transação) ---
    const foramEnviadosNovosArquivos = req.files && Array.isArray(req.files) && req.files.length > 0;
    if (foramEnviadosNovosArquivos && despesaOriginal.urlComprovante) {
      const caminhosAntigos = despesaOriginal.urlComprovante.split(',');
      const deleteFilePromises = caminhosAntigos.map(caminho => {
        const fullPath = path.join(__dirname, '../../..', caminho);
        return fs.unlink(fullPath).catch(err => ({ error: err, path: fullPath }));
      });

      const results = await Promise.allSettled(deleteFilePromises);
      results.forEach(result => {
        if (result.status === 'rejected' && result.reason.error.code !== 'ENOENT') {
            logEvents(`Falha ao apagar arquivo antigo: ${result.reason.path}`, LOG_FILE);
        }
      });
    }

    // --- 6. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade: updatedExpense.idPropriedade,
      idAutor: userId,
      mensagem: `A despesa '${updatedExpense.descricao}' foi atualizada por '${userName}'.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para atualização de despesa: ${err.message}`, LOG_FILE);
    });

    // --- 7. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Despesa atualizada e custos recalculados com sucesso.',
      data: updatedExpense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao atualizar despesa: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao atualizar a despesa.' });
  }
};