/**
 * @file permission.route.ts
 * @description Define as rotas da API para o gerenciamento de permissões e vínculos
 * entre usuários e propriedades.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';

// Importação dos controllers relevantes para esta rota
import { getUsuariosPropriedades } from '../controllers/Permission/get.Permission.controller';
// O nome exportado era 'getByIDsuariosPropriedades', então corrigimos a importação.
import { getByIDsuariosPropriedades as getUsersByPropertyId } from '../controllers/Permission/getById.Permission.controller';
import { updatePermission } from '../controllers/Permission/update.Permission.controller';
// Adicione aqui outros controllers de permissão que você venha a utilizar (ex: criar ou remover vínculo).

export const permission = express.Router();

/**
 * @route   GET /api/v1/permission
 * @desc    Lista todos os vínculos do sistema (com paginação e busca).
 * @access  Privado (requer autenticação)
 */
permission.get('/', protect, getUsuariosPropriedades);

/**
 * @route   GET /api/v1/permission/:id
 * @desc    Lista os vínculos de uma propriedade específica, usando o ID da propriedade.
 * @access  Privado (requer autenticação)
 */
permission.get('/:id', protect, getUsersByPropertyId);

/**
 * @route   PUT /api/v1/permission/:id
 * @desc    Atualiza a permissão de um vínculo usuário-propriedade específico.
 * O :id na URL refere-se ao ID do registro na tabela 'UsuariosPropriedades'.
 * @access  Privado (requer autenticação e permissão de 'proprietario_master')
 */
permission.put('/:id', protect, updatePermission);

