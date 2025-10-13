// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';

/**
 * Schema para validar os parâmetros da rota (ID da propriedade).
 */
const paramsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Schema para validar as regras de agendamento enviadas no corpo da requisição.
 * Todos os campos são opcionais para permitir atualizações parciais.
 */
const rulesSchema = z.object({
  duracaoMinimaEstadia: z.number().int().min(1, "A duração mínima deve ser de pelo menos 1 dia.").optional(),
  duracaoMaximaEstadia: z.number().int().min(1, "A duração máxima deve ser de pelo menos 1 dia.").optional(),
  horarioCheckin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "O formato do horário de check-in é inválido (HH:mm).").optional(),
  horarioCheckout: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "O formato do horário de check-out é inválido (HH:mm).").optional(),
  prazoCancelamentoReserva: z.number().int().min(0, "O prazo de cancelamento não pode ser negativo.").optional(),
  limiteFeriadosPorCotista: z.number().int().min(0).optional().nullable(),
  limiteReservasAtivasPorCotista: z.number().int().min(0).optional().nullable(),
});

/**
 * Atualiza as regras de agendamento de uma propriedade, incluindo as
 * novas quotas de uso, e notifica os membros sobre a alteração.
 */
export const updateSchedulingRules = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    
    const { propertyId } = paramsSchema.parse(req.params);
    const dataToUpdate = rulesSchema.parse(req.body);

    // Validação de segurança: Apenas um proprietário master pode alterar as regras.
    const masterLink = await prisma.usuariosPropriedades.findFirst({
      where: {
        idPropriedade: propertyId,
        idUsuario: userId,
        permissao: 'proprietario_master',
      },
    });

    if (!masterLink) {
      return res.status(403).json({ success: false, message: "Acesso negado. Apenas proprietários master podem alterar as regras de agendamento." });
    }

    // Validação de lógica de negócio: a duração máxima não pode ser menor que a mínima.
    if (dataToUpdate.duracaoMaximaEstadia && dataToUpdate.duracaoMinimaEstadia && dataToUpdate.duracaoMaximaEstadia < dataToUpdate.duracaoMinimaEstadia) {
        throw new Error("A duração máxima da estadia não pode ser menor que a duração mínima.");
    }

    // Atualiza as regras da propriedade no banco de dados.
    const updatedProperty = await prisma.propriedades.update({
      where: { id: propertyId },
      data: dataToUpdate,
    });
    
    // Cria a notificação para registrar a atividade.
    await createNotification({
        idPropriedade: propertyId,
        idAutor: userId,
        mensagem: `O usuário '${userName}' atualizou as regras de agendamento da propriedade '${updatedProperty.nomePropriedade}'.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Regras de agendamento atualizadas com sucesso.',
      data: updatedProperty,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    return res.status(400).json({ success: false, message: errorMessage });
  }
};
