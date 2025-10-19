// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Marcar Notificações como Lidas
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que permite a um usuário autenticado
 * marcar uma ou mais notificações como lidas.
 *
 * A operação é otimizada para performance e segurança:
 * 1.  Valida a autenticação do usuário e a lista de IDs de notificação.
 * 2.  Utiliza uma única e eficiente operação `update` com um `connect` aninhado
 * do Prisma. Isso adiciona o usuário à relação "lida por" de múltiplas
 * notificações de uma só vez, de forma atômica e idempotente.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'notification.log';

// Define o schema de validação para o corpo da requisição.
const markAsReadSchema = z.object({
  notificationIds: z
    .array(z.number().int().positive())
    .min(1, { message: 'É necessário fornecer ao menos um ID de notificação.' }),
});

/**
 * Processa a marcação de uma ou mais notificações como lidas para o usuário logado.
 */
export const markNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;
    const { notificationIds } = markAsReadSchema.parse(req.body);

    // --- 2. Atualização do Status de Leitura no Banco de Dados ---
    // A operação 'connect' em uma relação N-para-N é a forma mais eficiente
    // de criar os vínculos. O Prisma gerencia a criação dos registros na tabela
    // de junção e garante que não haja duplicatas. A ação é idempotente.
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificacoesLidas: {
          connect: notificationIds.map((id) => ({ id })),
        },
      },
    });

    // --- 3. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Notificações marcadas como lidas com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    // Registra qualquer erro inesperado para fins de monitoramento.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao marcar notificações como lidas: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao marcar as notificações.',
    });
  }
};