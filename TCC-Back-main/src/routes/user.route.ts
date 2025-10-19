// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Usuário
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * gerenciamento de usuários (CRUD). Cada rota é associada ao seu respectivo
 * controlador e protegida com os middlewares de segurança apropriados
 * (autenticação e autorização baseada em papéis).
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { verifyRoles } from '../middleware/verifyRoles';
import { ROLES_LIST } from '../config/rolesList';
import { uploadProfile } from '../middleware/upload';

// Importação dos controladores de usuário
import { getUser } from '../controllers/User/get.User.controller';
import { getUserById } from '../controllers/User/getById.User.controller';
import { updateUser } from '../controllers/User/update.User.controller';
import { deleteUserById } from '../controllers/User/deleteById.User.controller';

// Criação do roteador para o escopo de usuário.
export const user = express.Router();

// Rota para listar todos os usuários do sistema.
// Acesso: Restrito a Administradores.
user.get('/', protect, verifyRoles(ROLES_LIST.Admin), getUser);

// Rota para buscar um usuário específico pelo seu ID.
// Acesso: Privado (requer autenticação). O controlador garante que um usuário
// só pode acessar seu próprio perfil.
user.get('/:id', protect, getUserById);

// Rota para atualizar os dados de um usuário, incluindo a foto de perfil.
// O middleware 'uploadProfile' processa o arquivo 'fotoPerfil' se ele for enviado.
// Acesso: Privado (requer autenticação). A autorização é tratada no controlador.
user.put('/:id', protect, uploadProfile.single('fotoPerfil'), updateUser);



// Rota para realizar o soft-delete e anonimização de um usuário específico.
// Acesso: Privado (requer autenticação). A autorização é tratada no controlador.
user.delete('/:id', protect, deleteUserById);