// Todos direitos autorais reservados pelo QOTA.

/**
 * Job para Atualização de Despesas Vencidas
 *
 * Descrição:
 * Este arquivo contém a lógica para um "job" (tarefa agendada) que é responsável
 * por manter o status das despesas atualizado no sistema.
 *
 * O processo é projetado para ser executado periodicamente (ex: uma vez por dia):
 * 1.  Busca por todas as despesas que estão com status 'PENDENTE' ou
 * 'PARCIALMENTE_PAGO' e cuja data de vencimento já passou.
 * 2.  Atualiza o status de todas essas despesas para 'ATRASADO' em uma única
 * operação otimizada no banco de dados.
 * 3.  Dispara notificações em segundo plano para cada propriedade afetada,
 * informando sobre a despesa que agora está em atraso.
 *
 * Toda a atividade do job é registrada em arquivos de log para monitoramento.
 */
import { prisma } from '../utils/prisma';
import { createNotification } from '../utils/notification.service';
import { logEvents } from '../middleware/logEvents';

// --- Constantes e Configurações ---

// ID do usuário "Sistema", idealmente carregado de variáveis de ambiente.
const SYSTEM_USER_ID = parseInt(process.env.SYSTEM_USER_ID || '1', 10);
const LOG_FILE = 'overdueExpenses.log';

/**
 * Executa o job que procura por despesas vencidas e atualiza seus status.
 */
export const runUpdateOverdueExpensesJob = async () => {
  logEvents('Iniciando job de verificação de despesas vencidas...', LOG_FILE);

  try {
    // --- 1. Busca por Despesas Vencidas ---
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera o horário para a comparação abranger o dia inteiro.

    // Busca todas as despesas pendentes com data de vencimento anterior a hoje.
    const despesasVencidas = await prisma.despesa.findMany({
      where: {
        status: { in: ['PENDENTE', 'PARCIALMENTE_PAGO'] },
        dataVencimento: { lt: hoje }, // lt = less than (menor que)
      },
    });

    if (despesasVencidas.length === 0) {
      logEvents('Nenhuma despesa vencida encontrada. Job concluído.', LOG_FILE);
      return;
    }

    logEvents(`${despesasVencidas.length} despesa(s) vencida(s) encontrada(s). Atualizando status...`, LOG_FILE);
    const idsDasDespesasVencidas = despesasVencidas.map((d) => d.id);

    // --- 2. Atualização em Massa do Status ---
    // Atualiza todas as despesas encontradas para 'ATRASADO' em uma única query.
    const updateResult = await prisma.despesa.updateMany({
      where: {
        id: { in: idsDasDespesasVencidas },
      },
      data: {
        status: 'ATRASADO',
      },
    });

    // --- 3. Disparo de Notificações (Desempenho) ---
    // Itera sobre as despesas para disparar notificações individuais em modo "fire-and-forget".
    for (const despesa of despesasVencidas) {
      createNotification({
        idPropriedade: despesa.idPropriedade,
        idAutor: SYSTEM_USER_ID,
        mensagem: `A despesa '${despesa.descricao}' venceu e agora está marcada como atrasada.`,
      }).catch(notificationError => {
        // Se a criação de uma notificação falhar, apenas registra o erro sem interromper o job.
        const errorMessage = notificationError instanceof Error ? notificationError.message : 'Erro desconhecido';
        logEvents(`ERRO: Falha ao criar notificação para a despesa ID ${despesa.id}: ${errorMessage}`, LOG_FILE);
      });
    }

    // --- 4. Finalização do Job ---
    logEvents(`Job concluído. ${updateResult.count} despesa(s) atualizada(s) para 'ATRASADO'.`, LOG_FILE);
  
  } catch (jobError) {
    // Captura qualquer erro inesperado durante a execução principal do job.
    const errorMessage = jobError instanceof Error ? jobError.message : 'Erro desconhecido';
    logEvents(`ERRO CRÍTICO no job de despesas vencidas: ${errorMessage}\n${jobError instanceof Error ? jobError.stack : ''}`, LOG_FILE);
  }
};