// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Upload de Fotos de Itens de Inventário
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que gerencia o upload de uma nova
 * foto para um item de inventário específico. O processo é seguro e otimizado
 * para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação, autorização e os dados da requisição.
 * 2.  Verificar se o item de inventário associado existe.
 * 3.  Aplicar a regra de negócio que limita o número de fotos por item.
 * 4.  Criar um novo registro para a foto no banco de dados.
 * 5.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'inventory.log';

// --- Constantes e Schemas de Validação ---

// Define o limite máximo de fotos permitidas por item de inventário.
const MAX_PHOTOS_PER_ITEM = 6;

// Schema para validar o ID do item de inventário recebido no corpo da requisição.
const uploadSchema = z.object({
  idItemInventario: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'O ID do item de inventário é inválido.',
    }),
});

/**
 * Processa o upload de uma nova foto para um item de inventário.
 */
export const uploadInventoryPhoto = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { idItemInventario } = uploadSchema.parse(req.body);
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo de foto foi enviado.',
      });
    }

    // --- 2. Verificação do Item de Inventário de Destino ---
    const inventoryItem = await prisma.itemInventario.findUnique({
      where: { id: idItemInventario },
    });
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'O item de inventário associado não foi encontrado.',
      });
    }

    // --- 3. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é membro da propriedade antes de permitir a ação.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: inventoryItem.idPropriedade,
            idUsuario: userId,
        }
    });
    if (!userPermission) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Você não tem permissão para adicionar fotos a este inventário.' });
    }

    // --- 4. Aplicação da Regra de Negócio (Limite de Fotos) ---
    const photoCount = await prisma.fotoInventario.count({
      where: { idItemInventario: idItemInventario, excludedAt: null },
    });

    if (photoCount >= MAX_PHOTOS_PER_ITEM) {
      return res.status(400).json({
        success: false,
        message: `Limite de ${MAX_PHOTOS_PER_ITEM} fotos por item atingido.`,
      });
    }

    // --- 5. Criação do Registro da Foto no Banco de Dados ---
    const { filename } = req.file;
    const url = `/uploads/inventory/${filename}`;

    const newPhoto = await prisma.fotoInventario.create({
      data: {
        idItemInventario,
        filename,
        url,
      },
    });

    // --- 6. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: inventoryItem.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' adicionou uma nova foto ao item '${inventoryItem.nome}'.`,
    }).catch(err => {
        logEvents(`Falha ao criar notificação para upload de foto de inventário: ${err.message}`, LOG_FILE);
    });

    // --- 7. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: 'Foto enviada com sucesso.',
      data: newPhoto,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao fazer upload de foto de inventário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao enviar a foto.',
    });
  }
};