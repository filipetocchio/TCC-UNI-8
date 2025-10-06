// Todos direitos autorais reservados pelo QOTA.

/**
 * @file permission.route.ts
 * @description Define as rotas da API para o gerenciamento de permissões e vínculos
 * entre usuários e propriedades, incluindo a gestão de cotas.
 */

import express from 'express';
import { protect } from '../middleware/authMiddleware';

// Importação de todos os controllers utilizados por este roteador
import { getUsuariosPropriedades } from '../controllers/Permission/get.Permission.controller';
import { getByIDsuariosPropriedades as getUsersByPropertyId } from '../controllers/Permission/getById.Permission.controller';
import { updatePermission } from '../controllers/Permission/update.Permission.controller';
import { updateCotaPermission } from '../controllers/Permission/updateCota.Permission.controller';
import { unlinkUserFromProperty } from '../controllers/Permission/unlink.Permission.controller'; 

export const permission = express.Router();
/**
 * @route   DELETE /api/v1/permission/unlink/me/:vinculoId
 * @desc    Permite que o usuário autenticado remova seu próprio vínculo com uma propriedade.
 * @access  Privado
 */
permission.delete('/unlink/me/:vinculoId', protect, unlinkUserFromProperty);
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
 * @route   PUT /api/v1/permission/cota/:vinculoId
 * @desc    Atualiza a porcentagem de cota de um vínculo específico.
 * @access  Privado (requer permissão de 'proprietario_master')
 */
permission.put('/cota/:vinculoId', protect, updateCotaPermission);

/**
 * @route   PUT /api/v1/permission/:id
 * @desc    Atualiza a permissão (role) de um vínculo específico.
 * @access  Privado (requer permissão de 'proprietario_master')
 */
permission.put('/:id', protect, updatePermission);