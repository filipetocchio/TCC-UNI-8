// D:\Qota - TCC\TCC-Back_End\TCC-Back\src\routes\inventoryPhoto.route.ts
// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import { uploadInventoryPhoto } from '../controllers/InventoryPhoto/upload.InventoryPhoto.controller';
import { uploadInventory } from '../middleware/upload';
import { deleteInventoryPhotoById } from '../controllers/InventoryPhoto/deleteById.InventoryPhoto.controller'; // 1. IMPORTE

export const inventoryPhoto = express.Router();

// A rota espera um campo 'photo' no formulário multipart
inventoryPhoto.post('/upload', uploadInventory.single('photo'), uploadInventoryPhoto);
inventoryPhoto.delete('/:id', deleteInventoryPhotoById);