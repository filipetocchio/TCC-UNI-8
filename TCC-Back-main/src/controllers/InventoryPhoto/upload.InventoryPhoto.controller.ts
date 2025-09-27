/**
 * @file upload.InventoryPhoto.controller.ts
 * @description Controller responsável pelo upload e persistência de fotos
 * associadas a um item de inventário específico.
 */
// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * @name uploadSchema
 * @description Define a validação para os dados recebidos no corpo da requisição
 * de upload. Garante que o ID do item de inventário seja um número positivo,
 * assegurando a integridade do dado antes de prosseguir com a lógica.
 */
const uploadSchema = z.object({
  idItemInventario: z.string().transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'ID do item de inventário inválido.' }),
});

/**
 * @function uploadInventoryPhoto
 * @async
 * @description Manipula a requisição de upload de uma foto para um item de inventário.
 * @param {Request} req - O objeto de requisição do Express, contendo o arquivo (req.file) e os dados (req.body).
 * @param {Response} res - O objeto de resposta do Express.
 * @returns {Promise<Response>} Retorna uma resposta JSON indicando sucesso ou falha.
 */
export const uploadInventoryPhoto = async (req: Request, res: Response) => {
  try {
    const { idItemInventario } = uploadSchema.parse(req.body);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de foto foi enviado.' });
    }

    const inventoryItem = await prisma.itemInventario.findUnique({
      where: { id: idItemInventario },
    });
    if (!inventoryItem) {
      return res.status(404).json({ success: false, message: 'Item de inventário não encontrado.' });
    }

    // Conta quantas fotos o item já possui.
    const photoCount = await prisma.fotoInventario.count({
      where: { idItemInventario: idItemInventario, excludedAt: null },
    });

    // Se já tiver 6 ou mais, retorna um erro.
    if (photoCount >= 6) {
      return res.status(400).json({
        success: false,
        message: 'Limite de 6 fotos por item atingido.',
      });
    }

    const { filename } = req.file;
    const url = `/uploads/inventory/${filename}`;

    const newPhoto = await prisma.fotoInventario.create({
      data: {
        idItemInventario,
        filename,
        url,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Foto enviada com sucesso.',
      data: newPhoto,
    });
  } catch (error) {
    // Bloco de Tratamento de Erros
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    console.error('Erro no upload de foto de inventário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};