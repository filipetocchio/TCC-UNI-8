// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Fotos de Propriedades
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * gerenciamento de fotos de propriedades. Cada rota é associada ao seu respectivo
 * controlador e protegida com os middlewares de segurança apropriados.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { verifyRoles } from '../middleware/verifyRoles';
import { ROLES_LIST } from '../config/rolesList';
import { uploadPropertyPhoto as uploadMiddleware } from '../middleware/upload';

// Importação dos controladores
import { uploadPropertyPhoto } from '../controllers/PropertyPhoto/upload.PropertyPhoto.controller';
import { getPropertyPhoto } from '../controllers/PropertyPhoto/get.PropertyPhoto.controller';
import { getPropertyPhotoById } from '../controllers/PropertyPhoto/getById.PropertyPhoto.controller';
import { deletePropertyPhoto } from '../controllers/PropertyPhoto/delete.PropertyPhoto.controller';
import { deletePropertyPhotoById } from '../controllers/PropertyPhoto/deleteById.PropertyPhoto.controller';

// Criação do roteador para o escopo de fotos de propriedades.
export const propertyPhoto = express.Router();

// Rota para realizar o upload de uma nova foto para uma propriedade.
// Acesso: Privado (requer autenticação).
propertyPhoto.post(
  '/upload',
  protect,
  uploadMiddleware.single('foto'),
  uploadPropertyPhoto
);

// Rota para listar TODAS as fotos de TODAS as propriedades.
// Acesso: Restrito a Administradores.
propertyPhoto.get('/', protect, verifyRoles(ROLES_LIST.Admin), getPropertyPhoto);

// Rota para buscar uma foto específica pelo seu ID.
// Acesso: Privado. A autorização (ser membro da propriedade) é feita no controlador.
propertyPhoto.get('/:id', protect, getPropertyPhotoById);

// Rota para deletar TODAS as fotos de TODAS as propriedades.
// ATENÇÃO: Operação de alto impacto e risco.
// Acesso: Restrito a Administradores.
propertyPhoto.delete('/', protect, verifyRoles(ROLES_LIST.Admin), deletePropertyPhoto);

// Rota para deletar uma foto específica pelo seu ID.
// Acesso: Privado. A autorização (ser master da propriedade) é feita no controlador.
propertyPhoto.delete('/:id', protect, deletePropertyPhotoById);