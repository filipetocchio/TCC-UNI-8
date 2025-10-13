// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../utils/prisma';
import { createExpenseWithPayments } from '../services/expense.service';
import { createNotification } from '../utils/notification.service';
import { Despesa } from '@prisma/client';

/**
 * Define o início e o fim de um determinado dia.
 * @param date - A data de referência.
 * @returns Um objeto com as datas de início e fim.
 */
const getDayBoundaries = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
};

/**
 * Procura por despesas recorrentes que precisam ser criadas no dia atual e as gera.
 */
export const runCreateRecurringExpensesJob = async () => {
  console.log('[Job] Iniciando verificação de despesas recorrentes...');
  const hoje = new Date();
  
  const templates = await prisma.despesa.findMany({
    where: {
      recorrente: true,
      recorrenciaPaiId: null, // Garante que estamos pegando apenas os "templates"
    },
  });

  if (templates.length === 0) {
    console.log('[Job] Nenhuma despesa recorrente configurada.');
    return;
  }

  for (const template of templates) {
    let deveCriarHoje = false;
    let novaDataVencimento = new Date(hoje);
    let periodoVerificacao = getDayBoundaries(hoje); // Padrão é diário

    // Define se a despesa deve ser criada hoje e qual sua nova data de vencimento
    switch (template.frequencia) {
      case 'DIARIO':
        deveCriarHoje = true;
        // A data de vencimento é o próprio dia da criação.
        novaDataVencimento = hoje;
        break;

      case 'SEMANAL':
        // No frontend, o dia da semana deve ser salvo como número (0=Domingo, 6=Sábado)
        if (hoje.getDay() === template.diaRecorrencia) {
          deveCriarHoje = true;
          novaDataVencimento = hoje;
          // Período de verificação para a semana atual
          const primeiroDiaSemana = new Date(hoje.setDate(hoje.getDate() - hoje.getDay()));
          periodoVerificacao = getDayBoundaries(primeiroDiaSemana); // Verifica a partir do início da semana
        }
        break;
        
      case 'MENSAL':
        if (hoje.getDate() === template.diaRecorrencia) {
          deveCriarHoje = true;
          novaDataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), template.diaRecorrencia!);
          // Período de verificação para o mês atual
          const inicioDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          const fimDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
          periodoVerificacao = { gte: inicioDoMes, lte: fimDoMes };
        }
        break;

      case 'ANUAL':
        const mesOriginal = template.dataVencimento.getMonth();
        const diaOriginal = template.dataVencimento.getDate();
        if (hoje.getMonth() === mesOriginal && hoje.getDate() === diaOriginal) {
          deveCriarHoje = true;
          novaDataVencimento = new Date(hoje.getFullYear(), mesOriginal, diaOriginal);
           // Período de verificação para o ano atual
          const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);
          const fimDoAno = new Date(hoje.getFullYear(), 11, 31);
          periodoVerificacao = { gte: inicioDoAno, lte: fimDoAno };
        }
        break;
    }

    if (!deveCriarHoje) {
      continue;
    }

    // Verifica se uma despesa para este template e este período já não foi criada.
    const jaExiste = await prisma.despesa.findFirst({
      where: {
        recorrenciaPaiId: template.id,
        createdAt: periodoVerificacao,
      },
    });

    if (jaExiste) {
      console.log(`[Job] Despesa recorrente '${template.descricao}' já existe para este período. Pulando.`);
      continue;
    }

    // Prepara os dados da nova despesa, omitindo campos do template que não devem ser copiados.
    const { id, createdAt, updatedAt, ...restOfTemplate } = template;
    const novaDespesaData = {
      ...restOfTemplate,
      dataVencimento: novaDataVencimento,
      recorrenciaPaiId: template.id,
      recorrente: false, // A despesa filha não é um template
      status: 'PENDENTE' as const, // Define o status inicial como pendente
    };
    
    console.log(`[Job] Criando nova despesa recorrente para '${template.descricao}'...`);
    try {
      await prisma.$transaction(async (tx) => {
        // Usa o serviço para criar a despesa e seus pagamentos.
        const novaDespesa = await createExpenseWithPayments(novaDespesaData, tx);
        
        await createNotification({
          idPropriedade: novaDespesa.idPropriedade,
          idAutor: 1, // Autor "Sistema"
          mensagem: `Nova despesa recorrente gerada automaticamente: '${novaDespesa.descricao}'.`,
        });
      });
    } catch (error) {
      console.error(`[Job] Erro ao criar despesa recorrente para o template ID ${template.id}:`, error);
    }
  }
  console.log('[Job] Verificação de despesas recorrentes concluída.');
};