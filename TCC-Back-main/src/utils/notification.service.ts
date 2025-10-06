// Todos direitos autorais reservados pelo QOTA.

import { prisma } from './prisma';

/**
 * Parâmetros para a criação de uma notificação.
 */
interface NotificationParams {
  idPropriedade: number;
  idAutor: number;
  mensagem: string;
}

/**
 * Cria e armazena uma nova notificação no banco de dados.
 * Esta função é projetada para ser chamada "fire-and-forget", ou seja,
 * ela executa em segundo plano sem bloquear a resposta da requisição principal.
 * @param params - Os dados necessários para criar a notificação.
 */
export const createNotification = async (params: NotificationParams): Promise<void> => {
  try {
    await prisma.notificacao.create({
      data: {
        idPropriedade: params.idPropriedade,
        idAutor: params.idAutor,
        mensagem: params.mensagem,
      },
    });
  } catch (error) {
    // Em um ambiente de produção, um erro aqui deveria ser enviado
    // para um serviço de logging mais robusto (ex: Sentry, DataDog).
    console.error("Falha ao criar notificação:", error);
  }
};