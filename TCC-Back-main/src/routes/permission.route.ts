// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import { protect } from '../middleware/authMiddleware';

// Importação dos controllers com nomes diretos e sem aliases.
import { getUsuariosPropriedades } from '../controllers/Permission/get.Permission.controller';
import { getUsersByPropertyId } from '../controllers/Permission/getById.Permission.controller';
import { updatePermission } from '../controllers/Permission/update.Permission.controller';
import { updateCotaPermission } from '../controllers/Permission/updateCota.Permission.controller';
import { unlinkUserFromProperty } from '../controllers/Permission/unlink.Permission.controller'; 
import { unlinkMemberFromProperty } from '../controllers/Permission/unlinkMember.Permission.controller';
import { getPropertiesByUser } from '../controllers/Permission/getPropertiesByUser.Permission.controller';

export const permission = express.Router();

// --- ROTAS ESPECÍFICAS ---
// Rotas com palavras-chave fixas são declaradas primeiro para garantir que sejam
// correspondidas antes das rotas genéricas com parâmetros.

/**
 * @route   GET /api/v1/permission/user/:id/properties
 * @desc    Lista todas as propriedades associadas a um usuário específico.
 * @access  Privado
 */
permission.get('/user/:id/properties', protect, getPropertiesByUser);

/**
 * @route   DELETE /api/v1/permission/unlink/me/:vinculoId
 * @desc    Permite que o usuário autenticado remova seu próprio vínculo.
 * @access  Privado
 */
permission.delete('/unlink/me/:vinculoId', protect, unlinkUserFromProperty);

/**
 * @route   DELETE /api/v1/permission/unlink/member/:vinculoId
 * @desc    Permite que um master remova outro membro da propriedade.
 * @access  Privado (Master)
 */
permission.delete('/unlink/member/:vinculoId', protect, unlinkMemberFromProperty);

/**
 * @route   PUT /api/v1/permission/cota/:vinculoId
 * @desc    Atualiza a porcentagem de cota de um vínculo específico.
 * @access  Privado (Master)
 */
permission.put('/cota/:vinculoId', protect, updateCotaPermission);


// --- ROTAS GENÉRICAS ---
// Rotas que usam parâmetros genéricos na raiz do router devem vir por último
// para não capturar requisições destinadas a rotas mais específicas.

/**
 * @route   GET /api/v1/permission
 * @desc    Lista todos os vínculos do sistema (rota administrativa).
 * @access  Privado
 */
permission.get('/', protect, getUsuariosPropriedades);

/**
 * @route   GET /api/v1/permission/:id
 * @desc    Lista todos os membros (vínculos) de uma propriedade específica.
 * @access  Privado
 */
permission.get('/:id', protect, getUsersByPropertyId);

/**
 * @route   PUT /api/v1/permission/:id
 * @desc    Atualiza a permissão (role) de um vínculo específico.
 * @access  Privado (Master)
 */
permission.put('/:id', protect, updatePermission);