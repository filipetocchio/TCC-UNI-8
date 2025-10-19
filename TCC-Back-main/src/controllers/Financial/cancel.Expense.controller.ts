// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Cancelamento de Despesa
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que cancela uma despesa existente.
 * A operação é segura, otimizada para performance e utiliza o `errorHandler`
 * centralizado para um tratamento de erros robusto.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é 'proprietario_master').
 * 2.  Verificar se a despesa existe e se já não foi cancelada.
 * 3.  Atualizar o status da despesa para 'CANCELADO'.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';
import { z } from 'zod';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'financial.log';

// Schema para validar o ID da despesa nos parâmetros da rota.
const paramsSchema = z.object({
    expenseId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Processa o cancelamento de uma despesa.
 */
export const cancelExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { expenseId } = paramsSchema.parse(req.params);

    // --- 2. Busca e Validação da Despesa ---
    const expenseExists = await prisma.despesa.findUnique({
      where: { id: expenseId },
    });

    if (!expenseExists) {
      return res.status(404).json({ success: false, message: 'Despesa não encontrada.' });
    }
    if (expenseExists.status === 'CANCELADO') {
      return res.status(400).json({ success: false, message: 'Esta despesa já foi cancelada anteriormente.' });
    }
    
    // --- 3. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: userId,
        idPropriedade: expenseExists.idPropriedade,
        permissao: 'proprietario_master',
      }
    });

    if (!userPermission) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Apenas proprietários master podem cancelar uma despesa.' });
    }

    // --- 4. Execução da Atualização de Status ---
    const canceledExpense = await prisma.despesa.update({
      where: { id: expenseId },
      data: { status: 'CANCELADO' },
    });

    // --- 5. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: canceledExpense.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' cancelou a despesa '${canceledExpense.descricao}'.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para cancelamento de despesa: ${err.message}`, LOG_FILE);
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Despesa cancelada com sucesso.',
      data: canceledExpense,
    });

  } catch (error) {
    // Delega o tratamento de todos os erros para o middleware centralizado.
    if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao cancelar despesa: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao cancelar a despesa.' });
  }
};