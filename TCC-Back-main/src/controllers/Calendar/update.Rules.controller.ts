// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Regras de Agendamento
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que permite a um "proprietario_master"
 * atualizar as regras de agendamento de uma propriedade. O processo é seguro e
 * otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é 'proprietario_master').
 * 2.  Verificar a consistência das novas regras (ex: duração máxima >= mínima).
 * 3.  Aplicar as atualizações parciais no banco de dados.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'calendar.log';

// --- Schemas de Validação ---

const paramsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
});

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
 * Atualiza as regras de agendamento de uma propriedade.
 */
export const updateSchedulingRules = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    
    const { propertyId } = paramsSchema.parse(req.params);
    const dataToUpdate = rulesSchema.parse(req.body);

    // --- 2. Verificação de Autorização e Busca dos Dados Atuais (Segurança) ---
    // Garante que o usuário é um 'proprietario_master' e busca a propriedade em uma só consulta.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
      where: {
        idPropriedade: propertyId,
        idUsuario: userId,
        permissao: 'proprietario_master',
      },
      include: {
          propriedade: true
      }
    });

    if (!userPermission) {
      return res.status(403).json({ success: false, message: "Acesso negado. Apenas proprietários master podem alterar as regras." });
    }
    const { propriedade: currentProperty } = userPermission;

    // --- 3. Validação de Lógica de Negócio (Robustez) ---
    // Compara os novos valores com os existentes para garantir a consistência das regras.
    const finalMinEstadia = dataToUpdate.duracaoMinimaEstadia ?? currentProperty.duracaoMinimaEstadia;
    const finalMaxEstadia = dataToUpdate.duracaoMaximaEstadia ?? currentProperty.duracaoMaximaEstadia;

    if (finalMaxEstadia < finalMinEstadia) {
      throw new Error("A duração máxima da estadia não pode ser menor que a duração mínima.");
    }

    // --- 4. Execução da Atualização ---
    const updatedProperty = await prisma.propriedades.update({
      where: { id: propertyId },
      data: dataToUpdate,
    });
    
    // --- 5. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
        idPropriedade: propertyId,
        idAutor: userId,
        mensagem: `O usuário '${userName}' atualizou as regras de agendamento da propriedade '${updatedProperty.nomePropriedade}'.`,
    }).catch(err => {
        logEvents(`Falha ao criar notificação para atualização de regras: ${err.message}`, LOG_FILE);
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Regras de agendamento atualizadas com sucesso.',
      data: updatedProperty,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
        return res.status(400).json({ success: false, message: error.message });
    }

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao atualizar regras de agendamento: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor.' });
  }
};