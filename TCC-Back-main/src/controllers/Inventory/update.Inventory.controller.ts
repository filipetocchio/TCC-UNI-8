// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Itens de Inventário
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint de atualização de um item de
 * inventário existente. Ele permite a modificação parcial dos dados e é um
 * processo seguro e otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é master da propriedade).
 * 2.  Verificar se o item a ser atualizado existe e está ativo.
 * 3.  Aplicar as atualizações no banco de dados.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'inventory.log';

// --- Schemas de Validação ---

// Schema para validar os campos opcionais no corpo da requisição.
const updateInventoryItemSchema = z.object({
  nome: z.string().min(1).max(150).optional(),
  quantidade: z.number().int().positive().optional(),
  estadoConservacao: z
    .enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO'])
    .optional(),
  categoria: z.string().optional(),
  dataAquisicao: z.string().datetime().optional().nullable(),
  descricao: z.string().optional().nullable(),
  valorEstimado: z.number().positive().optional().nullable(),
  codigoBarras: z.string().optional().nullable(),
});

// Schema para validar o ID do item nos parâmetros da rota.
const paramsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

/**
 * Processa a atualização de um item de inventário e notifica os membros.
 */
export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { id: itemId } = paramsSchema.parse(req.params);
    const dataToUpdate = updateInventoryItemSchema.parse(req.body);

    // --- 2. Busca e Verificação do Item de Inventário ---
    const itemExists = await prisma.itemInventario.findFirst({
      where: { id: itemId, excludedAt: null },
    });

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: 'O item de inventário não foi encontrado ou está inativo.',
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
            message: 'Acesso negado. Apenas proprietários master podem editar itens do inventário.'
        });
    }

    // --- 4. Execução da Atualização do Item ---
    const updatedItem = await prisma.itemInventario.update({
      where: { id: itemId },
      data: {
        ...dataToUpdate,
        // Converte a string de data, se fornecida, para um objeto Date.
        dataAquisicao: dataToUpdate.dataAquisicao
          ? new Date(dataToUpdate.dataAquisicao)
          : undefined,
      },
    });

    // --- 5. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: updatedItem.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' atualizou o item '${updatedItem.nome}' no inventário.`,
    }).catch(err => {
      // Se a criação da notificação falhar, apenas registra o erro em background.
      logEvents(`Falha ao criar notificação para atualização de item: ${err.message}`, LOG_FILE);
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'O item do inventário foi atualizado com sucesso.',
      data: updatedItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao atualizar item de inventário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao atualizar o item.',
    });
  }
};