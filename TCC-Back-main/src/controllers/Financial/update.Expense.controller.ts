// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

/**
 * Schema de validação para a atualização de despesas.
 * Utiliza 'coerce' para converter tipos de dados recebidos de FormData (string)
 * para os tipos esperados pelo banco de dados (number, boolean).
 */
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
 * Atualiza os dados de uma despesa existente, recalcula a divisão de custos
 * e gerencia a substituição de arquivos de comprovante.
 */
export const updateExpense = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { expenseId } = req.params;
    const validatedData = updateExpenseSchema.parse(req.body);

    // Busca a despesa original fora da transação para obter informações cruciais.
    const despesaOriginal = await prisma.despesa.findUnique({
      where: { id: Number(expenseId) },
    });

    if (!despesaOriginal) {
      return res.status(404).json({ success: false, message: "Despesa não encontrada para atualização." });
    }

    // Validação de permissão de segurança.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: userId,
        idPropriedade: despesaOriginal.idPropriedade,
        permissao: 'proprietario_master',
      }
    });
    const isMaster = !!userPermission;
    const isAuthor = despesaOriginal.criadoPorId === userId;

    if (!isAuthor && !isMaster) {
      return res.status(403).json({ success: false, message: "Acesso negado. Você não tem permissão para editar esta despesa." });
    }
    
    // Executa todas as modificações no banco de dados dentro de uma transação.
    const updatedExpense = await prisma.$transaction(async (tx: TransactionClient) => {
      
      const novosComprovantes = req.files && Array.isArray(req.files) && req.files.length > 0
          ? (req.files as Express.Multer.File[]).map(file => `/uploads/invoices/${file.filename}`).join(',')
          : undefined;

      const dataToUpdate: Prisma.DespesaUpdateInput = {
        ...validatedData,
        observacao: validatedData.observacao ?? null,
        frequencia: validatedData.frequencia ?? null,
        diaRecorrencia: validatedData.diaRecorrencia ?? null,
        dataVencimento: new Date(validatedData.dataVencimento),
      };

      if (novosComprovantes !== undefined) {
        dataToUpdate.urlComprovante = novosComprovantes;
      }
      
      const despesaAtualizada = await tx.despesa.update({
        where: { id: Number(expenseId) },
        data: dataToUpdate,
      });

      // Se o valor foi alterado, recalcula a divisão entre os cotistas.
      if (validatedData.valor !== despesaOriginal.valor) {
        const cotistas = await tx.usuariosPropriedades.findMany({
          where: {
            idPropriedade: despesaOriginal.idPropriedade,
            porcentagemCota: { gt: 0 },
          },
        });

        if (cotistas.length > 0) {
            let valorTotalDistribuido = 0;
            const pagamentosParaAtualizar = cotistas.map(cotista => {
              const novoValorDevido = parseFloat(((validatedData.valor / 100) * cotista.porcentagemCota).toFixed(2));
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

            for (const pagamento of pagamentosParaAtualizar) {
              await tx.pagamentoCotista.updateMany({
                where: { idDespesa: despesaAtualizada.id, idCotista: pagamento.idCotista },
                data: { valorDevido: pagamento.novoValorDevido },
              });
            }
        }
      }

      return despesaAtualizada;
    });

    // Após a transação ser bem-sucedida, apaga os arquivos de comprovante antigos.
    const foramEnviadosNovosArquivos = req.files && Array.isArray(req.files) && req.files.length > 0;
    if (foramEnviadosNovosArquivos && despesaOriginal.urlComprovante) {
      const caminhosAntigos = despesaOriginal.urlComprovante.split(',');
      for (const caminho of caminhosAntigos) {
        const fullPath = path.join(__dirname, '../../..', caminho);
        fs.unlink(fullPath, (err) => {
          if (err) console.error(`[Update] Falha ao apagar arquivo antigo: ${fullPath}`, err);
          else console.log(`[Update] Arquivo antigo apagado com sucesso: ${fullPath}`);
        });
      }
    }

    await createNotification({
      idPropriedade: updatedExpense.idPropriedade,
      idAutor: userId,
      mensagem: `A despesa '${updatedExpense.descricao}' foi atualizada por '${userName}'.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Despesa atualizada e custos recalculados com sucesso.',
      data: updatedExpense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor ao atualizar despesa.";
    console.error('[Update Expense Error]', errorMessage);
    return res.status(500).json({ success: false, message: errorMessage });
  }
};
