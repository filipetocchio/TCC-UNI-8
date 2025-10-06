// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { uploadInventoryPhoto } from '../controllers/InventoryPhoto/upload.InventoryPhoto.controller';
import { deleteInventoryPhotoById } from '../controllers/InventoryPhoto/deleteById.InventoryPhoto.controller';
import { uploadInventory } from '../middleware/upload';

export const inventoryPhoto = express.Router();

/**
 * @route   POST /api/v1/inventoryPhoto/upload
 * @desc    Faz o upload de uma foto para um item de inventário.
 * @access  Privado
 */
inventoryPhoto.post('/upload', protect, uploadInventory.single('photo'), uploadInventoryPhoto);

/**
 * @route   DELETE /api/v1/inventoryPhoto/:id
 * @desc    Realiza o soft-delete de uma foto de inventário específica.
 * @access  Privado
 */
inventoryPhoto.delete('/:id', protect, deleteInventoryPhotoById);