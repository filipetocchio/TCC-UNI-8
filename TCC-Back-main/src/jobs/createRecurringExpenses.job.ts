// Todos direitos autorais reservados pelo QOTA.

/**
 * Job para Criação Automática de Despesas Recorrentes
 *
 * Descrição:
 * Este arquivo contém a lógica para um "job" (tarefa agendada) que é responsável
 * por gerar automaticamente as despesas recorrentes do sistema.
 *
 * O processo é projetado para ser executado periodicamente (ex: uma vez por dia):
 * 1.  Busca todos os "templates" de despesas marcados como recorrentes.
 * 2.  Para cada template, verifica se uma nova despesa deve ser criada no dia atual,
 * com base na sua frequência (diária, semanal, mensal, anual).
 * 3.  Garante que nenhuma despesa duplicada seja criada para o mesmo período.
 * 4.  Cria a nova instância da despesa, seus rateios de pagamento e dispara uma
 * notificação em segundo plano para os membros da propriedade.
 *
 * Toda a atividade do job é registrada em arquivos de log para monitoramento.
 */
import { prisma } from '../utils/prisma';
import { createExpenseWithPayments } from '../services/expense.service';
import { createNotification } from '../utils/notification.service'; 
import { logEvents } from '../middleware/logEvents';

// --- Constantes e Funções Auxiliares ---

// ID do usuário "Sistema", idealmente carregado de variáveis de ambiente.
const SYSTEM_USER_ID = parseInt(process.env.SYSTEM_USER_ID || '1', 10);
const LOG_FILE = 'recurringExpenses.log';

/**
 * Retorna um objeto com as datas de início e fim de um determinado dia.
 * @param date A data de referência.
 */
const getDayBoundaries = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { gte: start, lte: end };
};

/**
 * Executa o job que procura por despesas recorrentes e as cria se necessário.
 */
export const runCreateRecurringExpensesJob = async () => {
  logEvents('Iniciando job de criação de despesas recorrentes...', LOG_FILE);
  const hoje = new Date();

  // --- 1. Busca dos Templates de Despesas Recorrentes ---
  const templates = await prisma.despesa.findMany({
    where: {
      recorrente: true,
      recorrenciaPaiId: null, // Garante que estamos pegando apenas os modelos-pai.
    },
  });

  if (templates.length === 0) {
    logEvents('Nenhuma despesa recorrente configurada. Job concluído.', LOG_FILE);
    return;
  }

  logEvents(`Encontrados ${templates.length} templates de despesas para processar.`, LOG_FILE);

  // --- 2. Iteração sobre cada Template de Despesa ---
  for (const template of templates) {
    let deveCriarHoje = false;
    let novaDataVencimento = new Date(hoje);
    let periodoVerificacao = getDayBoundaries(hoje);

    try {
        // 2.1. Determinação da Lógica de Recorrência
        switch (template.frequencia) {
            case 'DIARIO':
              deveCriarHoje = true;
              novaDataVencimento = hoje;
              break;
            case 'SEMANAL':
              if (hoje.getDay() === template.diaRecorrencia) {
                deveCriarHoje = true;
                novaDataVencimento = hoje;
                const primeiroDiaSemana = new Date(hoje.setDate(hoje.getDate() - hoje.getDay()));
                periodoVerificacao = { gte: new Date(primeiroDiaSemana.setHours(0,0,0,0)), lte: new Date() };
              }
              break;
            case 'MENSAL':
              if (hoje.getDate() === template.diaRecorrencia) {
                deveCriarHoje = true;
                novaDataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), template.diaRecorrencia!);
                periodoVerificacao = { gte: new Date(hoje.getFullYear(), hoje.getMonth(), 1), lte: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59) };
              }
              break;
            case 'ANUAL':
              const mesOriginal = template.dataVencimento.getMonth();
              const diaOriginal = template.dataVencimento.getDate();
              if (hoje.getMonth() === mesOriginal && hoje.getDate() === diaOriginal) {
                deveCriarHoje = true;
                novaDataVencimento = new Date(hoje.getFullYear(), mesOriginal, diaOriginal);
                periodoVerificacao = { gte: new Date(hoje.getFullYear(), 0, 1), lte: new Date(hoje.getFullYear(), 11, 31, 23, 59, 59) };
              }
              break;
        }

        if (!deveCriarHoje) {
          continue;
        }

        // 2.2. Verificação de Idempotência (Evitar Duplicatas)
        const jaExiste = await prisma.despesa.findFirst({
            where: {
                recorrenciaPaiId: template.id,
                createdAt: { gte: periodoVerificacao.gte },
            },
        });

        if (jaExiste) {
          logEvents(`Despesa para o template '${template.descricao}' (ID: ${template.id}) já existe neste período. Pulando.`, LOG_FILE);
          continue;
        }

        // 2.3. Preparação e Criação da Nova Despesa
        const { id, createdAt, updatedAt, ...restOfTemplate } = template;
        const novaDespesaData = {
            ...restOfTemplate,
            dataVencimento: novaDataVencimento,
            recorrenciaPaiId: template.id,
            recorrente: false,
            status: 'PENDENTE' as const,
        };
      
        logEvents(`Criando nova instância para despesa recorrente '${template.descricao}' (ID: ${template.id}).`, LOG_FILE);

        const novaDespesa = await prisma.$transaction(async (tx) => {
          return await createExpenseWithPayments(novaDespesaData, tx);
        });

        // 2.4. Disparo da Notificação (Desempenho)
        createNotification({
          idPropriedade: novaDespesa.idPropriedade,
          idAutor: SYSTEM_USER_ID,
          mensagem: `Nova despesa recorrente gerada automaticamente: '${novaDespesa.descricao}'.`,
        }).catch(err => {
          logEvents(`Falha ao criar notificação para despesa recorrente: ${err.message}`, LOG_FILE);
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logEvents(`ERRO ao processar template de despesa ID ${template.id}: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    }
  }

  // --- 3. Finalização do Job ---
  logEvents('Job de criação de despesas recorrentes concluído.', LOG_FILE);
};