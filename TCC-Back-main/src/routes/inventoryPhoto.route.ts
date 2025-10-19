// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Fotos de Inventário
 *
 * Descrição:
 * Este arquivo define as rotas para o gerenciamento de fotos associadas a
 * itens de inventário, como upload e exclusão.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { uploadInventoryPhoto } from '../controllers/InventoryPhoto/upload.InventoryPhoto.controller';
import { deleteInventoryPhotoById } from '../controllers/InventoryPhoto/deleteById.InventoryPhoto.controller';
import { uploadInventory } from '../middleware/upload';

export const inventoryPhoto = express.Router();

// Rota para fazer o upload de uma foto para um item de inventário.
// Acesso: Privado.
inventoryPhoto.post(
  '/upload',
  protect,
  uploadInventory.single('photo'),
  uploadInventoryPhoto
);

// Rota para realizar o soft-delete de uma foto de inventário específica.
// Acesso: Privado.
inventoryPhoto.delete('/:id', protect, deleteInventoryPhotoById);