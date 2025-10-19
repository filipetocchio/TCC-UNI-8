// Todos direitos autorais reservados pelo QOTA.

/**
 * Serviço de Gerenciamento de Notificações
 *
 * Descrição:
 * Este arquivo encapsula a lógica de negócio para a criação de notificações.
 * A função principal, `createNotification`, é um serviço reutilizável projetado
 * para ser invocado por diferentes controladores e jobs.
 *
 * O serviço é otimizado para ser executado de forma não-bloqueante (fire-and-forget),
 * significando que os controladores podem disparar a criação de uma notificação
 * sem precisar aguardar sua conclusão, garantindo respostas de API mais rápidas.
 * Falhas na criação são registradas em log para monitoramento.
 */
import { prisma } from './prisma';
import { logEvents } from '../middleware/logEvents';

// Define o nome do arquivo de log para este serviço.
const LOG_FILE = 'notification.log';

/**
 * Define a estrutura de dados necessária para criar uma nova notificação.
 */
interface NotificationParams {
  idPropriedade: number;
  idAutor: number;
  mensagem: string;
}

/**
 * Cria e armazena uma nova notificação no banco de dados.
 * @param params Os dados necessários para criar a notificação.
 */
export const createNotification = async (
  params: NotificationParams
): Promise<void> => {
  try {
    // --- 1. Criação do Registro da Notificação ---
    // Insere a nova notificação no banco de dados.
    await prisma.notificacao.create({
      data: {
        idPropriedade: params.idPropriedade,
        idAutor: params.idAutor,
        mensagem: params.mensagem,
      },
    });
  } catch (error) {
    // --- 2. Tratamento de Erros ---
    // Se a criação da notificação falhar, registra o erro detalhadamente.
    // Isso é crucial para monitorar a saúde do sistema de notificações em produção.
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(
      `ERRO ao criar notificação: ${errorMessage}\n${
        error instanceof Error ? error.stack : ''
      }`,
      LOG_FILE
    );
  }
};