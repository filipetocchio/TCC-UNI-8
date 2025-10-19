// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão de Propriedade por ID (Soft Delete)
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que realiza a exclusão (soft delete)
 * de uma propriedade específica. A operação é segura e otimizada para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é 'proprietario_master').
 * 2.  Verificar se a propriedade existe e está ativa.
 * 3.  Marcar a propriedade como excluída, preenchendo o campo `excludedAt`.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'property.log';

// Define o schema de validação para o ID da propriedade recebido via parâmetros da URL.
const deletePropertyByIdSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'O ID da propriedade fornecido é inválido.',
    }),
});

/**
 * Processa a exclusão (soft delete) de uma propriedade com base em seu ID.
 */
export const deletePropertyById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { id: propertyId } = deletePropertyByIdSchema.parse(req.params);

    // --- 2. Verificação de Autorização e Existência da Propriedade (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    // Esta consulta também valida que a propriedade existe.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: propertyId,
            idUsuario: userId,
            permissao: 'proprietario_master'
        },
        include: {
            propriedade: true
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas proprietários master podem excluir a propriedade.'
        });
    }

    // --- 3. Verificação de Status (Impede re-exclusão) ---
    if (userPermission.propriedade.excludedAt) {
      return res.status(400).json({
        success: false,
        message: 'Esta propriedade já foi excluída anteriormente.',
      });
    }

    // --- 4. Execução do Soft Delete ---
    // Atualiza o registro da propriedade, preenchendo o campo 'excludedAt'.
    await prisma.propriedades.update({
      where: { id: propertyId },
      data: {
        excludedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // --- 5. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: propertyId,
      idAutor: userId,
      mensagem: `A propriedade '${userPermission.propriedade.nomePropriedade}' foi excluída por '${userName}'.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para exclusão de propriedade: ${err.message}`, LOG_FILE);
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'A propriedade foi marcada como excluída com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao excluir propriedade: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao excluir a propriedade.',
    });
  }
};