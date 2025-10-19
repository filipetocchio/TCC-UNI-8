// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão de Foto de Inventário por ID (Soft Delete)
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que realiza a exclusão (soft delete)
 * de uma foto específica de um item de inventário. O processo é seguro e otimizado
 * para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é master da propriedade).
 * 2.  Verificar se a foto existe e está ativa.
 * 3.  Marcar a foto como excluída. O arquivo físico no disco é preservado.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'inventory.log';

// Define o schema de validação para o ID da foto recebido via parâmetros da URL.
const paramsSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, { message: 'O ID da foto é inválido.' }),
});

/**
 * Processa a exclusão (soft delete) de uma foto de um item de inventário.
 */
export const deleteInventoryPhotoById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { id: photoId } = paramsSchema.parse(req.params);

    // --- 2. Busca e Verificação da Foto ---
    // Busca a foto e inclui dados relacionados para autorização e notificação.
    const photoExists = await prisma.fotoInventario.findFirst({
      where: { id: photoId, excludedAt: null },
      include: {
        itemInventario: {
          include: {
            propriedade: {
              select: { nomePropriedade: true },
            },
          },
        },
      },
    });

    if (!photoExists) {
      return res.status(404).json({
        success: false,
        message: 'A foto não foi encontrada ou já foi excluída.',
      });
    }
    
    // --- 3. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: photoExists.itemInventario.idPropriedade,
            idUsuario: userId,
            permissao: 'proprietario_master',
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas proprietários master podem excluir fotos do inventário.'
        });
    }

    // --- 4. Execução do Soft Delete ---
    // A foto é marcada como excluída, mas o registro e o arquivo físico permanecem.
    await prisma.fotoInventario.update({
      where: { id: photoId },
      data: { excludedAt: new Date() },
    });

    // --- 5. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: photoExists.itemInventario.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' removeu uma foto do item '${photoExists.itemInventario.nome}' na propriedade '${photoExists.itemInventario.propriedade.nomePropriedade}'.`,
    }).catch(err => {
      // Se a criação da notificação falhar, apenas registra o erro em background.
      logEvents(`Falha ao criar notificação para exclusão de foto de inventário: ${err.message}`, LOG_FILE);
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'A foto foi removida com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao excluir foto de inventário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao remover a foto.',
    });
  }
};