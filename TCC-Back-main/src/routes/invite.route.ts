// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Convites
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * sistema de convites. Cada rota é associada ao seu respectivo controlador e,
 * quando necessário, protegida por middlewares de autenticação.
 */
import express from 'express';
import { createInvite } from '../controllers/Invite/create.Invite.controller';
import { verifyInvite } from '../controllers/Invite/verify.Invite.controller';
import { acceptInvite } from '../controllers/Invite/accept.Invite.controller';
import { protect } from '../middleware/authMiddleware';
import { getPendingByProperty } from '../controllers/Invite/getPendingByProperty.Invite.controller';

// Criação do roteador para o escopo de convites.
export const invite = express.Router();

// Rota para a criação de um novo convite para uma propriedade.
// Acesso: Privado (requer autenticação e permissão de 'proprietario_master').
invite.post('/', protect, createInvite);

// Rota para verificar a validade de um token de convite.
// Acesso: Público.
invite.get('/verify/:token', verifyInvite);

// Rota para aceitar um convite, vinculando o usuário autenticado à propriedade.
// Acesso: Privado (requer autenticação).
invite.post('/accept/:token', protect, acceptInvite);

// Rota para listar todos os convites pendentes de uma propriedade específica.
// Acesso: Privado (requer autenticação).
invite.get('/property/:propertyId/pending', protect, getPendingByProperty);