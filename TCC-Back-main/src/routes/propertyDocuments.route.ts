// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Documentos de Propriedades
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * gerenciamento de documentos de propriedades. Cada rota é associada ao seu
 * respectivo controlador e protegida com os middlewares de segurança apropriados
 * (autenticação, autorização e processamento de uploads).
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { verifyRoles } from '../middleware/verifyRoles';
import { ROLES_LIST } from '../config/rolesList';
import { uploadDocument } from '../middleware/upload';

// Importação dos controladores
import { uploadPropertyDocument } from '../controllers/PropertyDocuments/upload.PropertyDocuments.controller';
import { getPropertyDocuments } from '../controllers/PropertyDocuments/get.PropertyDocuments.controller';
import { getPropertyDocumentsById } from '../controllers/PropertyDocuments/getById.PropertyDocuments.controller';
import { deletePropertyDocumentsById } from '../controllers/PropertyDocuments/deleteById.PropertyDocuments.controller';

// Criação do roteador para o escopo de documentos de propriedades.
export const propertyDocuments = express.Router();

// Rota para realizar o upload de um novo documento para uma propriedade.
// Acesso: Privado (requer autenticação). A autorização é tratada no controlador.
propertyDocuments.post(
  '/upload',
  protect,
  uploadDocument.single('documento'),
  uploadPropertyDocument
);

// Rota para listar TODOS os documentos do sistema.
// Acesso: Restrito a Administradores do Sistema.
propertyDocuments.get(
  '/',
  protect,
  verifyRoles(ROLES_LIST.Admin),
  getPropertyDocuments
);

// Rota para buscar um documento específico pelo seu ID.
// Acesso: Privado (requer autenticação). A autorização (ser membro) é feita no controlador.
propertyDocuments.get('/:id', protect, getPropertyDocumentsById);

// Rota para deletar um documento específico pelo seu ID.
// Acesso: Privado (requer autenticação). A autorização (ser master) é feita no controlador.
propertyDocuments.delete('/:id', protect, deletePropertyDocumentsById);