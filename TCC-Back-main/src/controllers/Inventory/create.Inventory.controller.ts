// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Criação de Itens de Inventário
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint de criação de um novo item no
 * inventário de uma propriedade específica. O processo é seguro e otimizado
 * para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação do usuário e os dados do novo item.
 * 2.  Autorizar a ação, garantindo que o usuário seja membro da propriedade.
 * 3.  Verificar se a propriedade de destino existe e está ativa.
 * 4.  Criar o registro do item no banco de dados.
 * 5.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'inventory.log';

// Schema para validar os dados de um novo item de inventário.
const createInventoryItemSchema = z.object({
  idPropriedade: z.number().int().positive(),
  nome: z.string().min(1, 'O nome do item é obrigatório.').max(150),
  quantidade: z.number().int().positive().optional().default(1),
  estadoConservacao: z
    .enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO'])
    .optional()
    .default('BOM'),
  categoria: z.string().optional(),
  dataAquisicao: z.string().datetime({ message: 'Formato de data inválido.' }).optional().nullable(),
  descricao: z.string().optional().nullable(),
  valorEstimado: z.number().positive().optional().nullable(),
  codigoBarras: z.string().optional().nullable(),
});

/**
 * Processa a criação de um novo item de inventário.
 */
export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const validatedData = createInventoryItemSchema.parse(req.body);
    const { idPropriedade } = validatedData;

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um membro da propriedade antes de permitir a ação.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: { idPropriedade, idUsuario: userId, usuario: { excludedAt: null } }
    });
    if (!userPermission) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Você não é membro desta propriedade.' });
    }

    // --- 3. Verificação da Propriedade de Destino ---
    const propertyExists = await prisma.propriedades.findFirst({
      where: { id: idPropriedade, excludedAt: null },
    });
    if (!propertyExists) {
      return res.status(404).json({
        success: false,
        message: 'A propriedade informada não foi encontrada ou está inativa.',
      });
    }
    
    // --- 4. Criação do Item de Inventário ---
    const newItem = await prisma.itemInventario.create({
      data: {
        ...validatedData,
        dataAquisicao: validatedData.dataAquisicao ? new Date(validatedData.dataAquisicao) : null,
      },
    });

    // --- 5. Disparo da Notificação (Desempenho) ---
    // A criação da notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' adicionou o item '${newItem.nome}' ao inventário.`,
    }).catch(err => {
      // Se a criação da notificação falhar, apenas registra o erro em background.
      logEvents(`Falha ao criar notificação para novo item de inventário: ${err.message}`, LOG_FILE);
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: `Item "${newItem.nome}" adicionado com sucesso ao inventário.`,
      data: newItem,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao criar item de inventário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao criar o item.',
    });
  }
};