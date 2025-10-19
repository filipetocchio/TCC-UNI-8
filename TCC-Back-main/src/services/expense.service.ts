// Todos direitos autorais reservados pelo QOTA.

/**
 * Serviço de Gerenciamento de Despesas
 *
 * Descrição:
 * Este arquivo encapsula a lógica de negócio complexa para a criação de despesas.
 * A função principal, `createExpenseWithPayments`, é um serviço reutilizável que
 * pode ser invocado por diferentes controladores ou jobs.
 *
 * A sua responsabilidade é garantir que, ao criar uma despesa, os registros de
 * pagamento individuais para cada cotista sejam gerados atomicamente, com a
 * divisão de custos baseada no número de frações de cada um e com um ajuste
 * para garantir que a soma dos valores seja sempre exata.
 */
import { prisma } from '../utils/prisma';
import { Prisma, Despesa } from '@prisma/client';

// --- Tipos de Dados ---

// Define um tipo para o cliente de transação do Prisma, para uso dentro do serviço.
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Define um tipo para os dados de criação de uma despesa, omitindo campos gerados pelo banco.
type ExpenseCreationData = Omit<Despesa, 'id' | 'status' | 'createdAt' | 'updatedAt'>;

/**
 * Cria uma despesa e seus respectivos registros de pagamento para cada cotista de forma transacional.
 * @param data Os dados da despesa a ser criada.
 * @param tx O cliente de transação do Prisma, garantindo que a operação seja atômica.
 * @returns O objeto da despesa recém-criada.
 */
export const createExpenseWithPayments = async (data: ExpenseCreationData, tx: TransactionClient) => {
  // --- 1. Criação da Despesa Principal ---
  // O registro da despesa é criado primeiro para termos um ID para associar aos pagamentos.
  const despesa = await tx.despesa.create({ data });

  // --- 2. Busca dos Dados da Propriedade e dos Cotistas ---
  // Busca a propriedade para obter o número total de frações.
  const propriedade = await tx.propriedades.findUnique({
      where: { id: data.idPropriedade }
  });
  if (!propriedade || propriedade.totalFracoes <= 0) {
      throw new Error('A propriedade não foi encontrada ou não possui um total de frações definido para o rateio.');
  }

  // Busca todos os membros da propriedade que possuem uma ou mais frações.
  const cotistas = await tx.usuariosPropriedades.findMany({
    where: {
      idPropriedade: data.idPropriedade,
      numeroDeFracoes: { gt: 0 },
    },
  });

  if (cotistas.length === 0) {
    throw new Error('Não há cotistas com frações definidas para esta propriedade; a despesa não pôde ser criada.');
  }

  // --- 3. Lógica de Divisão de Custos baseada em Frações ---
  // Calcula o valor devido por cada cotista com base na proporção de suas frações.
  let valorTotalDistribuido = 0;
  const pagamentosParaCriar = cotistas.map(cotista => {
    const proporcao = cotista.numeroDeFracoes / propriedade.totalFracoes;
    const valorDevido = parseFloat((data.valor * proporcao).toFixed(2));
    valorTotalDistribuido += valorDevido;
    return {
      idDespesa: despesa.id,
      idCotista: cotista.idUsuario,
      valorDevido,
    };
  });

  // --- 4. Ajuste de Arredondamento ("Cêntimo Perdido") ---
  // Atribui qualquer diferença de arredondamento ao primeiro proprietário master
  // ou ao primeiro cotista para garantir que a soma seja exata.
  const diferenca = parseFloat((data.valor - valorTotalDistribuido).toFixed(2));
  if (diferenca !== 0) {
    const master = cotistas.find(c => c.permissao === 'proprietario_master') || cotistas[0];
    const pagamentoDoAjuste = pagamentosParaCriar.find(p => p.idCotista === master.idUsuario);
    if (pagamentoDoAjuste) {
      pagamentoDoAjuste.valorDevido = parseFloat((pagamentoDoAjuste.valorDevido + diferenca).toFixed(2));
    }
  }

  // --- 5. Criação em Massa dos Registros de Pagamento ---
  // Insere todos os registros de pagamento individuais em uma única operação otimizada.
  await tx.pagamentoCotista.createMany({
    data: pagamentosParaCriar,
  });

  return despesa;
};