// Todos direitos autorais reservados pelo QOTA.

/**
 * Job para Renovação Anual do Saldo de Diárias
 *
 * Descrição:
 * Este arquivo contém a lógica para um "job" (tarefa agendada) crítico que é
 * responsável por renovar o saldo de diárias de todos os cotistas no início
 * de cada ano.
 *
 * O processo é projetado para ser executado uma vez por ano (em 1º de janeiro):
 * 1.  Busca todos os vínculos de usuários que possuem uma ou mais frações.
 * 2.  Para cada vínculo, recalcula o saldo total de diárias para o novo ano com
 * base no seu número de frações e no direito a diárias da propriedade.
 * 3.  Atualiza o saldo de todos os cotistas em uma única transação atômica e
 * otimizada para performance.
 * 4.  Dispara notificações em segundo plano para informar os usuários.
 *
 * Toda a atividade do job é registrada em arquivos de log para monitoramento.
 */
import { prisma } from '../utils/prisma';
import { createNotification } from '../utils/notification.service';
import { logEvents } from '../middleware/logEvents';
import { Prisma } from '@prisma/client';

// --- Constantes e Configurações ---
const LOG_FILE = 'annualReset.log';
const SYSTEM_USER_ID = parseInt(process.env.SYSTEM_USER_ID || '1', 10);
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

/**
 * Executa o job que renova o saldo de diárias de todos os cotistas.
 */
export const runResetDailyBalancesJob = async () => {
  logEvents('Iniciando job de renovação anual do saldo de diárias...', LOG_FILE);
  const currentYear = new Date().getFullYear();

  try {
    // --- 1. Busca de Todos os Vínculos com Frações ---
    // Busca todos os vínculos que possuem frações, incluindo os dados da propriedade para o cálculo.
    const vinculosParaAtualizar = await prisma.usuariosPropriedades.findMany({
      where: {
        numeroDeFracoes: { gt: 0 },
        propriedade: { excludedAt: null }, // Garante que apenas propriedades ativas sejam processadas.
      },
      include: {
        propriedade: {
          select: { diariasPorFracao: true, nomePropriedade: true },
        },
      },
    });

    if (vinculosParaAtualizar.length === 0) {
      logEvents('Nenhum cotista com frações encontrado para renovar o saldo. Job concluído.', LOG_FILE);
      return;
    }

    logEvents(`Encontrados ${vinculosParaAtualizar.length} saldos de cotistas para renovar.`, LOG_FILE);

    // --- 2. Execução da Atualização em Massa (Transacional e Performático) ---
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Prepara todas as operações de atualização para serem executadas em paralelo.
      const updatePromises = vinculosParaAtualizar.map(vinculo => {
        // Calcula o novo saldo anual completo para o cotista.
        const novoSaldoAnual = vinculo.numeroDeFracoes * vinculo.propriedade.diariasPorFracao;
        
        return tx.usuariosPropriedades.update({
          where: { id: vinculo.id },
          data: { saldoDiariasAtual: novoSaldoAnual },
        });
      });

      // Executa todas as atualizações de saldo em paralelo para máxima performance.
      await Promise.all(updatePromises);
    });
    
    // --- 3. Disparo de Notificações (Pós-Transação e em Segundo Plano) ---
    // Após o sucesso da transação, notifica os usuários sobre a renovação do saldo.
    vinculosParaAtualizar.forEach(vinculo => {
        createNotification({
            idPropriedade: vinculo.idPropriedade,
            idAutor: SYSTEM_USER_ID,
            mensagem: `Seu saldo de diárias para a propriedade '${vinculo.propriedade.nomePropriedade}' foi renovado para o ano de ${currentYear}.`,
        }).catch(err => {
            logEvents(`ERRO: Falha ao criar notificação de renovação para o vínculo ID ${vinculo.id}: ${err.message}`, LOG_FILE);
        });
    });

    // --- 4. Finalização do Job ---
    logEvents(`Job concluído. ${vinculosParaAtualizar.length} saldos de diárias foram renovados com sucesso.`, LOG_FILE);

  } catch (jobError) {
    // Captura qualquer erro inesperado durante a execução principal do job.
    const errorMessage = jobError instanceof Error ? jobError.message : 'Erro desconhecido';
    logEvents(`ERRO CRÍTICO no job de renovação de saldos: ${errorMessage}\n${jobError instanceof Error ? jobError.stack : ''}`, LOG_FILE);
  }
};