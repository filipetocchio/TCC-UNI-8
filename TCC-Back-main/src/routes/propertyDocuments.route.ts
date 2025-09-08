/**
 * @file propertyDocuments.route.ts
 * @description Define as rotas da API para o gerenciamento de documentos de propriedades,
 * garantindo que todas as rotas sejam protegidas e utilizem os middlewares corretos.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { uploadDocument } from '../middleware/upload';

// Importação dos controllers relevantes para esta rota
import { uploadPropertyDocument } from '../controllers/PropertyDocuments/upload.PropertyDocuments.controller';
import { getPropertyDocuments } from '../controllers/PropertyDocuments/get.PropertyDocuments.controller';
import { getPropertyDocumentsById } from '../controllers/PropertyDocuments/getById.PropertyDocuments.controller';
import { deletePropertyDocumentsById } from '../controllers/PropertyDocuments/deleteById.PropertyDocuments.controller';

export const propertyDocuments = express.Router();

/**
 * @route   POST /api/v1/propertyDocuments/upload
 * @desc    Realiza o upload de um documento para uma propriedade.
 * A requisição passa primeiro pelo middleware 'protect' para garantir a autenticação,
 * depois pelo 'uploadDocument' para processar o arquivo enviado no campo 'documento',
 * e finalmente chega ao controller.
 * @access  Privado
 */
propertyDocuments.post('/upload', protect, uploadDocument.single('documento'), uploadPropertyDocument);

/**
 * @route   GET /api/v1/propertyDocuments
 * @desc    Lista todos os documentos do sistema (rota administrativa).
 * @access  Privado
 */
propertyDocuments.get('/', protect, getPropertyDocuments);

/**
 * @route   GET /api/v1/propertyDocuments/:id
 * @desc    Busca um documento específico pelo seu ID.
 * @access  Privado
 */
propertyDocuments.get('/:id', protect, getPropertyDocumentsById);

/**
 * @route   DELETE /api/v1/propertyDocuments/:id
 * @desc    Deleta (soft delete) um documento específico pelo seu ID.
 * @access  Privado (requer permissão de 'proprietario_master')
 */
propertyDocuments.delete('/:id', protect, deletePropertyDocumentsById);

