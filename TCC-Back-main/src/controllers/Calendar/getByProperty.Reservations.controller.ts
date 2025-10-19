// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem de Reservas por Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera uma lista de todas as
 * reservas de uma propriedade que ocorrem dentro de um intervalo de datas especificado.
 * É o principal endpoint utilizado para popular a visualização do calendário.
 *
 * O acesso a este endpoint é seguro, sendo restrito apenas a membros autenticados
 * da propriedade em questão, garantindo a privacidade do calendário de uso.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'calendar.log';

// Schema para validar os parâmetros da requisição para buscar reservas.
const getReservationsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  startDate: z.string().datetime({ message: "A data de início é inválida." }),
  endDate: z.string().datetime({ message: "A data de fim é inválida." }),
});

/**
 * Busca e retorna todas as reservas de uma propriedade dentro de um intervalo de datas.
 */
export const getReservationsByProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;

    const { propertyId, startDate, endDate } = getReservationsSchema.parse({
      propertyId: req.params.propertyId,
      ...req.query,
    });

    const dataInicio = new Date(startDate);
    const dataFim = new Date(endDate);

    if (dataFim <= dataInicio) {
        return res.status(400).json({ success: false, message: "A data de fim deve ser posterior à data de início." });
    }

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é membro da propriedade que está tentando acessar.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: { idPropriedade: propertyId, idUsuario: userId }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Você não tem permissão para visualizar o calendário desta propriedade.'
        });
    }

    // --- 3. Construção da Cláusula de Busca ---
    // A cláusula 'where' busca por qualquer reserva que tenha intersecção com o período solicitado.
    const where: Prisma.ReservaWhereInput = {
        idPropriedade: propertyId,
        status: { not: 'CANCELADA' },
        AND: [
            { dataInicio: { lt: dataFim } },   // A reserva existente começa antes que o período de busca termine
            { dataFim: { gt: dataInicio } }, // E a reserva existente termina depois que o período de busca começa
        ],
    };

    // --- 4. Execução da Consulta ---
    const reservations = await prisma.reserva.findMany({
      where,
      orderBy: { dataInicio: 'asc' },
      select: {
        id: true,
        dataInicio: true,
        dataFim: true,
        status: true,
        usuario: {
          select: {
            id: true,
            nomeCompleto: true,
          },
        },
      },
    });

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Reservas recuperadas com sucesso.',
      data: reservations,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao buscar reservas da propriedade: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao buscar as reservas.' });
  }
};