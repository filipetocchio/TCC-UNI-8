// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Busca de Item de Inventário por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera os detalhes de um
 * item de inventário específico, identificado pelo seu ID.
 *
 * O processo é seguro, garantindo que apenas membros autenticados da propriedade
 * à qual o item pertence possam visualizar seus detalhes. A consulta otimizada
 * inclui uma lista de todas as fotos ativas para o item.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'inventory.log';

// Define o schema de validação para o ID do item recebido via parâmetros da URL.
const paramsSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, { message: 'O ID do item é inválido.' }),
});

/**
 * Processa a requisição para buscar os detalhes de um item de inventário específico.
 */
export const getInventoryItemById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;
    const { id: itemId } = paramsSchema.parse(req.params);

    // --- 2. Busca Detalhada do Item no Banco de Dados ---
    // Utiliza 'findUnique' para uma busca otimizada pelo ID do item.
    const inventoryItem = await prisma.itemInventario.findUnique({
      where: { id: itemId },
      include: {
        // Inclui apenas as fotos que não foram marcadas como excluídas.
        fotos: {
          where: {
            excludedAt: null,
          },
        },
      },
    });

    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'O item de inventário não foi encontrado.',
      });
    }

    // --- 3. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é membro da propriedade antes de liberar os dados.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: inventoryItem.idPropriedade,
            idUsuario: userId,
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Você não tem permissão para visualizar este item.'
        });
    }

    // --- 4. Envio da Resposta de Sucesso ---
    // A URL da foto não é modificada aqui, pois o front-end é responsável por
    // montar o caminho completo, esperando um caminho relativo do back-end.
    return res.status(200).json({
      success: true,
      message: 'O item de inventário foi recuperado com sucesso.',
      data: inventoryItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar item de inventário por ID: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar o item.',
    });
  }
};