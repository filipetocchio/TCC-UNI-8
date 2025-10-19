// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Check-in de Reserva
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint de check-in de uma reserva. O
 * processo é seguro e transacional.
 *
 * O processo é responsável por:
 * 1.  Validar que o usuário autenticado é o dono da reserva.
 * 2.  Garantir que a reserva está com o status 'CONFIRMADA' e que o check-in
 * ainda não foi realizado.
 * 3.  Criar um registro de checklist de inventário, detalhando o estado dos
 * itens na entrada do cotista.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 *
 * Toda a operação é executada dentro de uma transação para garantir a atomicidade dos dados.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'calendar.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// --- Schemas de Validação ---

// Schema para validar os dados de cada item do checklist.
const itemChecklistSchema = z.object({
  idItemInventario: z.number().int(),
  estadoConservacao: z.enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO']),
  observacao: z.string().optional().nullable(),
});

// Schema para validar o corpo da requisição de check-in.
const checkinSchema = z.object({
  reservationId: z.number().int(),
  observacoes: z.string().optional().nullable(),
  itens: z.array(itemChecklistSchema).min(1, { message: "O checklist de itens não pode estar vazio." }),
});

/**
 * Registra o check-in de uma reserva.
 */
export const performCheckin = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { reservationId, observacoes, itens } = checkinSchema.parse(req.body);

    // --- 2. Execução da Lógica Transacional de Check-in ---
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Validação da Reserva e da Autorização
      const reserva = await tx.reserva.findUnique({
        where: { id: reservationId },
        include: { propriedade: { select: { nomePropriedade: true } } },
      });

      if (!reserva) throw new Error("Reserva não encontrada.");
      if (reserva.idUsuario !== userId) throw new Error("Acesso negado. Você só pode fazer o check-in para suas próprias reservas.");
      if (reserva.status !== 'CONFIRMADA') throw new Error(`Não é possível fazer check-in para uma reserva com status '${reserva.status}'.`);
      
      const existingCheckin = await tx.checklistInventario.findFirst({
        where: { idReserva: reservationId, tipo: 'CHECKIN' },
      });
      if (existingCheckin) throw new Error("O check-in para esta reserva já foi realizado.");

      // 2.2. Criação do Registro Principal do Checklist
      const checklist = await tx.checklistInventario.create({
        data: { idReserva: reservationId, idUsuario: userId, tipo: 'CHECKIN', observacoes },
      });

      // 2.3. Criação dos Itens do Checklist
      // A operação 'createMany' é otimizada para inserção em massa.
      await tx.itemChecklist.createMany({
        data: itens.map(item => ({
          idChecklist: checklist.id,
          ...item,
        })),
      });

      // Retorna os dados necessários para as etapas seguintes.
      return { checklist, propertyName: reserva.propriedade.nomePropriedade, idPropriedade: reserva.idPropriedade };
    });

    // --- 3. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: result.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' realizou o check-in na propriedade '${result.propertyName}'.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para check-in: ${err.message}`, LOG_FILE);
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: 'Check-in realizado com sucesso!',
      data: result.checklist,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao realizar check-in: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor.' });
  }
};