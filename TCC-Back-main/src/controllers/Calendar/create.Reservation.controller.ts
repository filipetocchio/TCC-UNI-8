// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { Prisma } from '@prisma/client';
import { differenceInDays, isWithinInterval } from 'date-fns'; 
import axios from 'axios';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

/**
 * Schema para validação dos dados de entrada para a criação de uma nova reserva.
 */
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
        return response.data.map((holiday: any) => new Date(`${holiday.date}T12:00:00Z`)); // Usar Z para tratar como UTC
    } catch (error) {
        console.error(`Falha ao buscar feriados para o ano ${year}:`, error);
        return []; // Retorna um array vazio em caso de falha para não bloquear a reserva
    }
};

/**
 * Cria uma nova reserva para um usuário em uma propriedade, após validar
 * todas as regras de negócio (conflitos de data, duração, etc.).
 */
export const createReservation = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const validatedData = createReservationSchema.parse(req.body);
    
    const dataInicio = new Date(validatedData.dataInicio);
    const dataFim = new Date(validatedData.dataFim);

    const newReservation = await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Busca a propriedade e suas regras de agendamento.
      const property = await tx.propriedades.findUnique({
        where: { id: validatedData.idPropriedade },
      });
      if (!property) {
        throw new Error("Propriedade não encontrada.");
      }

      // 2. Validações de Regras de Negócio.
      if (dataFim <= dataInicio) {
        throw new Error("A data de fim deve ser posterior à data de início.");
      }
      
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      if (dataInicio < today) {
        throw new Error("Não é possível criar uma reserva para uma data no passado.");
      }
      
      // Declaração da variável movida para o local correto.
      const durationInDays = differenceInDays(dataFim, dataInicio);
      if (durationInDays < property.duracaoMinimaEstadia) {
        throw new Error(`A duração mínima da estadia é de ${property.duracaoMinimaEstadia} dias.`);
      }
      if (durationInDays > property.duracaoMaximaEstadia) {
        throw new Error(`A duração máxima da estadia é de ${property.duracaoMaximaEstadia} dias.`);
      }

      // 3. Validação de Quotas de Uso.
      if (property.limiteReservasAtivasPorCotista) {
        const activeReservationsCount = await tx.reserva.count({
          where: {
            idUsuario: userId,
            idPropriedade: validatedData.idPropriedade,
            status: 'CONFIRMADA',
            dataInicio: { gte: new Date() }
          }
        });

        if (activeReservationsCount >= property.limiteReservasAtivasPorCotista) {
          throw new Error(`Limite de ${property.limiteReservasAtivasPorCotista} reservas ativas atingido.`);
        }
      }
            // Validação de Limite de Feriados
      if (property.limiteFeriadosPorCotista && property.limiteFeriadosPorCotista > 0) {
        const startYear = dataInicio.getFullYear();
        const endYear = dataFim.getFullYear();
        
        // Busca feriados para os anos relevantes (geralmente um, mas pode ser dois em viradas de ano)
        const yearsToFetch = [...new Set([startYear, endYear])];
        const holidaysPromises = yearsToFetch.map(year => getHolidaysForYear(year));
        const holidaysByYear = await Promise.all(holidaysPromises);
        const allHolidays = holidaysByYear.flat();

        // Conta feriados na nova reserva
        const newHolidayCount = allHolidays.filter(holiday => isWithinInterval(holiday, { start: dataInicio, end: dataFim })).length;

        if (newHolidayCount > 0) {
          // Busca as outras reservas futuras do usuário nesta propriedade
          const userOtherReservations = await tx.reserva.findMany({
            where: {
              idUsuario: userId,
              idPropriedade: validatedData.idPropriedade,
              status: 'CONFIRMADA',
              dataInicio: { gte: new Date(`${startYear}-01-01`) }
            }
          });

          // Conta quantos feriados já existem nas outras reservas
          let existingHolidayCount = 0;
          for (const reservation of userOtherReservations) {
            existingHolidayCount += allHolidays.filter(holiday => 
                isWithinInterval(holiday, { start: new Date(reservation.dataInicio), end: new Date(reservation.dataFim) })
            ).length;
          }

          const totalHolidays = existingHolidayCount + newHolidayCount;
          if (totalHolidays > property.limiteFeriadosPorCotista) {
            throw new Error(`Limite de ${property.limiteFeriadosPorCotista} feriado(s) por ano atingido. Você já possui ${existingHolidayCount} e esta reserva adicionaria mais ${newHolidayCount}.`);
          }
        }
      }
      // 4. Validação de Conflito de Datas.
      const conflictingReservation = await tx.reserva.findFirst({
        where: {
          idPropriedade: validatedData.idPropriedade,
          status: { not: 'CANCELADA' },
          AND: [
            { dataInicio: { lt: dataFim } },
            { dataFim: { gt: dataInicio } },
          ],
        },
      });

      if (conflictingReservation) {
        throw new Error("As datas selecionadas já estão ocupadas.");
      }

      // 5. Cria a reserva no banco de dados.
      const reserva = await tx.reserva.create({
        data: {
          idPropriedade: validatedData.idPropriedade,
          idUsuario: userId,
          dataInicio,
          dataFim,
          numeroHospedes: validatedData.numeroHospedes,
        },
      });

      return { reserva, propertyName: property.nomePropriedade };
    });

    // 6. Cria a notificação para todos os membros.
    await createNotification({
      idPropriedade: newReservation.reserva.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' agendou uma nova reserva na propriedade '${newReservation.propertyName}' para o período de ${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}.`,
    });

    return res.status(201).json({
      success: true,
      message: 'Reserva criada com sucesso.',
      data: newReservation.reserva,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    return res.status(400).json({ success: false, message: errorMessage });
  }
};