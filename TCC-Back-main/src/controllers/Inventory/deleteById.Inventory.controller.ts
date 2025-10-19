// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão de Itens de Inventário por ID (Soft Delete)
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que realiza a exclusão (soft delete)
 * de um item de inventário específico. O processo é seguro e otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é master da propriedade).
 * 2.  Verificar se o item existe e está ativo.
 * 3.  Marcar o item como excluído, preenchendo o campo `excludedAt`.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'inventory.log';

// Define o schema de validação para o ID do item recebido via parâmetros da URL.
const deleteParamsSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, { message: 'O ID do item é inválido.' }),
});

/**
 * Processa a exclusão (soft delete) de um item de inventário.
 */
export const deleteInventoryItemById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { id: itemId } = deleteParamsSchema.parse(req.params);

    // --- 2. Busca e Verificação do Item ---
    // Garante que o item existe e ainda não foi excluído.
    const itemExists = await prisma.itemInventario.findFirst({
      where: { id: itemId, excludedAt: null },
    });

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: 'O item de inventário não foi encontrado ou já foi excluído.',
      });
    }

    // --- 3. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: itemExists.idPropriedade,
            idUsuario: userId,
            permissao: 'proprietario_master',
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas proprietários master podem excluir itens do inventário.'
        });
    }

    // --- 4. Execução do Soft Delete ---
    // O item é marcado como excluído ao invés de ser removido permanentemente.
    await prisma.itemInventario.update({
      where: { id: itemId },
      data: {
        excludedAt: new Date(),
      },
    });

    // --- 5. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: itemExists.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' removeu o item '${itemExists.nome}' do inventário.`,
    }).catch(err => {
      // Se a criação da notificação falhar, apenas registra o erro em background.
      logEvents(`Falha ao criar notificação para exclusão de item de inventário: ${err.message}`, LOG_FILE);
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'O item foi removido do inventário com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao excluir item de inventário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao remover o item.',
    });
  }
};