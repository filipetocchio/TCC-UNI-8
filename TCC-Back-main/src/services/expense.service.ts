// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../utils/prisma';
import { Prisma, Despesa } from '@prisma/client';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;
type ExpenseCreationData = Omit<Despesa, 'id' | 'status' | 'createdAt' | 'updatedAt'>;

/**
 * Serviço reutilizável para criar uma despesa e seus pagamentos correspondentes.
 * Pode ser usado dentro de uma transação Prisma existente.
 * @param data - Os dados da despesa a ser criada.
 * @param tx - O cliente de transação do Prisma.
 */
export const createExpenseWithPayments = async (data: ExpenseCreationData, tx: TransactionClient) => {
  // 1. Cria a despesa principal.
  const despesa = await tx.despesa.create({ data });

  // 2. Busca cotistas para a divisão.
  const cotistas = await tx.usuariosPropriedades.findMany({
    where: {
      idPropriedade: data.idPropriedade,
      porcentagemCota: { gt: 0 },
    },
  });

  if (cotistas.length === 0) {
    throw new Error("Não há cotistas com cota definida para esta propriedade.");
  }

  // 3. Lógica de Divisão de Custos.
  let valorTotalDistribuido = 0;
  const pagamentosParaCriar = cotistas.map(cotista => {
    const valorDevido = parseFloat(((data.valor / 100) * cotista.porcentagemCota).toFixed(2));
    valorTotalDistribuido += valorDevido;
    return {
      idDespesa: despesa.id,
      idCotista: cotista.idUsuario,
      valorDevido,
    };
  });

  // 4. Ajuste do "cêntimo perdido".
  const diferenca = parseFloat((data.valor - valorTotalDistribuido).toFixed(2));
  if (diferenca !== 0) {
    const master = cotistas.find(c => c.permissao === 'proprietario_master') || cotistas[0];
    const pagamentoDoAjuste = pagamentosParaCriar.find(p => p.idCotista === master.idUsuario);
    if (pagamentoDoAjuste) {
      pagamentoDoAjuste.valorDevido = parseFloat((pagamentoDoAjuste.valorDevido + diferenca).toFixed(2));
    }
  }

  // 5. Cria os registros de pagamento individuais.
  await tx.pagamentoCotista.createMany({
    data: pagamentosParaCriar,
  });

  return despesa;
};