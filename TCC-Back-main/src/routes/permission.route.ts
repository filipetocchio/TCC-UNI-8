// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Permissões e Vínculos
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * gerenciamento de permissões, cotas e vínculos entre usuários e propriedades.
 * Cada rota é associada ao seu respectivo controlador e protegida com os
 * middlewares de segurança apropriados.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { verifyRoles } from '../middleware/verifyRoles';
import { ROLES_LIST } from '../config/rolesList';

// Importação dos controladores de permissão
import { getUsuariosPropriedades } from '../controllers/Permission/get.Permission.controller';
import { getUsersByPropertyId } from '../controllers/Permission/getById.Permission.controller';
import { getPropertiesByUser } from '../controllers/Permission/getPropertiesByUser.Permission.controller';
import { updatePermission } from '../controllers/Permission/update.Permission.controller';
import { updateCotaPermission } from '../controllers/Permission/updateCota.Permission.controller';
import { unlinkUserFromProperty } from '../controllers/Permission/unlink.Permission.controller';
import { unlinkMemberFromProperty } from '../controllers/Permission/unlinkMember.Permission.controller';

// Criação do roteador para o escopo de permissões.
export const permission = express.Router();


// --- Rotas Administrativas ---

// Rota para listar todos os vínculos do sistema.
// Acesso: Restrito a Administradores.
permission.get('/', protect, verifyRoles(ROLES_LIST.Admin), getUsuariosPropriedades);


// --- Rotas de Consulta ---

// Rota para listar todas as propriedades associadas a um usuário específico.
// Acesso: Privado. A autorização (acesso próprio) é tratada no controlador.
permission.get('/user/:id/properties', protect, getPropertiesByUser);

// Rota para listar todos os membros (vínculos) de uma propriedade específica.
// Acesso: Privado. A autorização (ser membro) é tratada no controlador.
permission.get('/:id', protect, getUsersByPropertyId);


// --- Rotas de Modificação de Vínculo (Ações de Master) ---

// Rota para atualizar a permissão (role) de um vínculo específico.
// Acesso: Privado. A autorização (ser master) é tratada no controlador.
permission.put('/:id', protect, updatePermission);

// Rota para atualizar a porcentagem de cota de um vínculo específico.
// Acesso: Privado. A autorização (ser master) é tratada no controlador.
permission.put('/cota/:vinculoId', protect, updateCotaPermission);

// Rota para permitir que um master remova outro membro da propriedade.
// Acesso: Privado. A autorização (ser master) é tratada no controlador.
permission.delete('/unlink/member/:vinculoId', protect, unlinkMemberFromProperty);


// --- Rota de Ação do Usuário ---

// Rota para permitir que o usuário autenticado remova seu próprio vínculo.
// Acesso: Privado. A autorização (acesso próprio) é tratada no controlador.
permission.delete('/unlink/me/:vinculoId', protect, unlinkUserFromProperty);