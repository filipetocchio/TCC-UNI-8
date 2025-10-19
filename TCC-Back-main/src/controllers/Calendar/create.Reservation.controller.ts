// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Criação de Reservas
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint de criação de uma nova reserva.
 * O processo é seguro, transacional e otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação, autorização (se o usuário é membro) e os dados da reserva.
 * 2.  Verificar uma série de regras de negócio, como saldo de diárias, conflitos de
 * datas, duração da estadia e limites de uso.
 * 3.  Criar a reserva e debitar os dias do saldo do usuário em uma única transação atômica.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';
import { differenceInDays, isWithinInterval } from 'date-fns'; 
import axios from 'axios';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'calendar.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// --- Schemas de Validação ---
const createReservationSchema = z.object({
  idPropriedade: z.number().int().positive(),
  dataInicio: z.string().datetime({ message: "A data de início é inválida." }),
  dataFim: z.string().datetime({ message: "A data de fim é inválida." }),
  numeroHospedes: z.number().int().positive({ message: "O número de hóspedes deve ser maior que zero." }),
});

/**
 * Função auxiliar para buscar feriados nacionais de um ano na BrasilAPI.
 */
const getHolidaysForYear = async (year: number): Promise<Date[]> => {
    try {
        const response = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${year}`);
        return response.data.map((holiday: any) => new Date(`${holiday.date}T12:00:00Z`));
    } catch (error) {
        logEvents(`Falha ao buscar feriados para o ano ${year}: ${error}`, LOG_FILE);
        return []; // Retorna um array vazio em caso de falha para não bloquear a reserva.
    }
};

/**
 * Cria uma nova reserva para um usuário em uma propriedade.
 */
export const createReservation = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const validatedData = createReservationSchema.parse(req.body);
    
    const dataInicio = new Date(validatedData.dataInicio);
    const dataFim = new Date(validatedData.dataFim);

    // --- 2. Validações de Regras de Negócio (Pré-Transação) ---
    // Busca a permissão do usuário e as regras da propriedade em uma única consulta.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: { idUsuario: userId, idPropriedade: validatedData.idPropriedade },
        include: { propriedade: true },
    });
    
    if (!userPermission) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Você não é membro desta propriedade.' });
    }
    const { propriedade } = userPermission;

    // Validações de data e duração
    if (dataFim <= dataInicio) throw new Error("A data de fim deve ser posterior à data de início.");
    if (dataInicio < new Date(new Date().setHours(0, 0, 0, 0))) throw new Error("Não é possível criar uma reserva para uma data no passado.");
    
    const durationInDays = differenceInDays(dataFim, dataInicio);
    if (durationInDays < propriedade.duracaoMinimaEstadia) throw new Error(`A duração mínima da estadia é de ${propriedade.duracaoMinimaEstadia} dias.`);
    if (durationInDays > propriedade.duracaoMaximaEstadia) throw new Error(`A duração máxima da estadia é de ${propriedade.duracaoMaximaEstadia} dias.`);

    // Validação de Saldo de Diárias (Novo Fluxo)
    if (durationInDays > userPermission.saldoDiariasAtual) {
        throw new Error(`Saldo de diárias insuficiente. Você possui ${userPermission.saldoDiariasAtual} dias e a reserva solicita ${durationInDays}.`);
    }

    // Validação de Limite de Reservas Ativas
    if (propriedade.limiteReservasAtivasPorCotista) {
      const activeReservationsCount = await prisma.reserva.count({
        where: { idUsuario: userId, idPropriedade: validatedData.idPropriedade, status: 'CONFIRMADA', dataInicio: { gte: new Date() } }
      });
      if (activeReservationsCount >= propriedade.limiteReservasAtivasPorCotista) {
        throw new Error(`Limite de ${propriedade.limiteReservasAtivasPorCotista} reservas ativas atingido.`);
      }
    }

    // Validação de Limite de Feriados (com chamada externa fora da transação)
    if (propriedade.limiteFeriadosPorCotista && propriedade.limiteFeriadosPorCotista > 0) {
        const years = [...new Set([dataInicio.getFullYear(), dataFim.getFullYear()])];
        const allHolidays = (await Promise.all(years.map(getHolidaysForYear))).flat();
        const newHolidayCount = allHolidays.filter(h => isWithinInterval(h, { start: dataInicio, end: dataFim })).length;
        
        if (newHolidayCount > 0) {
            const userOtherReservations = await prisma.reserva.findMany({ where: { idUsuario: userId, idPropriedade: validatedData.idPropriedade, status: 'CONFIRMADA' } });
            let existingHolidayCount = 0;
            for (const r of userOtherReservations) {
                existingHolidayCount += allHolidays.filter(h => isWithinInterval(h, { start: r.dataInicio, end: r.dataFim })).length;
            }
            if (existingHolidayCount + newHolidayCount > propriedade.limiteFeriadosPorCotista) {
                throw new Error(`Limite de ${propriedade.limiteFeriadosPorCotista} feriado(s) atingido.`);
            }
        }
    }

    // --- 3. Execução da Lógica Transacional de Reserva ---
    const newReservation = await prisma.$transaction(async (tx: TransactionClient) => {
      // 3.1. Validação Final de Conflito de Datas (dentro da transação para lock)
      const conflictingReservation = await tx.reserva.findFirst({
        where: {
          idPropriedade: validatedData.idPropriedade,
          status: { not: 'CANCELADA' },
          AND: [{ dataInicio: { lt: dataFim } }, { dataFim: { gt: dataInicio } }],
        },
      });
      if (conflictingReservation) throw new Error("As datas selecionadas já estão ocupadas.");

      // 3.2. Cria a reserva no banco de dados.
      const reserva = await tx.reserva.create({
        data: {
          idPropriedade: validatedData.idPropriedade,
          idUsuario: userId,
          dataInicio,
          dataFim,
          numeroHospedes: validatedData.numeroHospedes,
        },
      });
      
      // 3.3. Debita os dias do saldo do usuário.
      await tx.usuariosPropriedades.update({
          where: { id: userPermission.id },
          data: { saldoDiariasAtual: { decrement: durationInDays } }
      });

      return reserva;
    });

    // --- 4. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade: newReservation.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' agendou uma nova reserva na propriedade '${propriedade.nomePropriedade}' para o período de ${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}.`,
    }).catch(err => logEvents(`Falha ao criar notificação para nova reserva: ${err.message}`, LOG_FILE));

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: 'Reserva criada com sucesso.',
      data: newReservation,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao criar reserva: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor.' });
  }
};