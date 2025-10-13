// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../utils/prisma';
import { createNotification } from '../utils/notification.service';

/**
 * Procura por despesas com status 'PENDENTE' ou 'PARCIALMENTE_PAGO' que já venceram
 * e atualiza seu status para 'ATRASADO', notificando os membros da propriedade.
 */
export const runUpdateOverdueExpensesJob = async () => {
  console.log('[Job] Iniciando verificação de despesas vencidas...');

  const hoje = new Date();
  // Define a data para o início do dia para garantir que a comparação seja justa.
  hoje.setHours(0, 0, 0, 0);

  // 1. Encontra todas as despesas que estão vencidas e ainda não foram pagas.
  const despesasVencidas = await prisma.despesa.findMany({
    where: {
      status: {
        in: ['PENDENTE', 'PARCIALMENTE_PAGO'],
      },
      dataVencimento: {
        lt: hoje, // 'lt' significa 'less than' (menor que)
      },
    },
  });

  if (despesasVencidas.length === 0) {
    console.log('[Job] Nenhuma despesa vencida encontrada.');
    return;
  }

  console.log(`[Job] ${despesasVencidas.length} despesa(s) vencida(s) encontrada(s). Atualizando status...`);

  const idsDasDespesasVencidas = despesasVencidas.map((d) => d.id);

  // 2. Atualiza o status de todas as despesas encontradas para 'ATRASADO' em uma única operação.
  const updateResult = await prisma.despesa.updateMany({
    where: {
      id: {
        in: idsDasDespesasVencidas,
      },
    },
    data: {
      status: 'ATRASADO',
    },
  });

  // 3. Cria uma notificação para cada despesa que foi atualizada.
  // Usamos um loop para criar notificações individuais e contextuais.
  for (const despesa of despesasVencidas) {
    try {
      await createNotification({
        idPropriedade: despesa.idPropriedade,
        // O autor da notificação pode ser um ID de sistema, ou usamos um ID de admin padrão se existir.
        // Por simplicidade, vamos assumir que o autor é o sistema (ID 1, por exemplo).
        // Em um sistema real, você poderia ter um usuário "Sistema".
        idAutor: 1, // Adapte se necessário
        mensagem: `A despesa '${despesa.descricao}' está atrasada.`,
      });
    } catch (notificationError) {
      console.error(`[Job] Falha ao criar notificação para a despesa ID ${despesa.id}:`, notificationError);
    }
  }

  console.log(`[Job] Concluído. ${updateResult.count} despesa(s) atualizada(s) para 'ATRASADO'.`);
};