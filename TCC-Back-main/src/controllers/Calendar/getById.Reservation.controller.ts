// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Busca de Reserva por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera os detalhes completos
 * de uma reserva específica, incluindo o usuário, a propriedade e os checklists
 * de inventário associados.
 *
 * A consulta é segura e otimizada, garantindo em uma única operação que apenas
 * membros autenticados da propriedade à qual a reserva pertence possam
 * visualizar seus detalhes.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'calendar.log';

/**
 * Schema para validar o parâmetro de ID da reserva vindo da rota.
 */
const paramsSchema = z.object({
  reservationId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Busca e retorna os detalhes completos de uma reserva específica.
 */
export const getReservationById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;
    const { reservationId } = paramsSchema.parse(req.params);

    // --- 2. Busca e Autorização em uma Única Consulta (Desempenho e Segurança) ---
    // A consulta busca a reserva e, ao mesmo tempo, verifica se o usuário
    // requisitante é membro da propriedade, combinando busca e autorização.
    const reservation = await prisma.reserva.findFirst({
      where: {
        id: reservationId,
        propriedade: {
          usuarios: {
            some: {
              idUsuario: userId,
            },
          },
        },
      },
      include: {
        usuario: {
          select: { id: true, nomeCompleto: true, email: true },
        },
        propriedade: {
          select: { id: true, nomePropriedade: true, horarioCheckin: true, horarioCheckout: true },
        },
        checklist: {
          include: {
            itens: {
              include: {
                itemInventario: {
                  select: { id: true, nome: true },
                },
              },
            },
          },
          orderBy: { data: 'asc' }, // Ordena para que o check-in venha antes do check-out.
        },
      },
    });

    // Se o resultado for nulo, ou a reserva não existe, ou o usuário não tem permissão.
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reserva não encontrada ou acesso negado.' });
    }

    // --- 3. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Detalhes da reserva recuperados com sucesso.',
      data: reservation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao buscar detalhes da reserva: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao buscar a reserva.' });
  }
};