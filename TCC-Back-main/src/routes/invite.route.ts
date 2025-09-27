/**
 * @file invite.route.ts
 * @description Define as rotas da API para o sistema de convites.
 * Inclui endpoints para criação, verificação e aceitação de convites.
 */
// Todos direitos autorais reservados pelo QOTA.


import express from 'express';
import { createInvite } from '../controllers/Invite/create.Invite.controller';
import { verifyInvite } from '../controllers/Invite/verify.Invite.controller';
import { acceptInvite } from '../controllers/Invite/accept.Invite.controller';
import { protect } from '../middleware/authMiddleware'; // Middleware para proteger rotas
import { getPendingByProperty } from '../controllers/Invite/getPendingByProperty.Invite.controller';
// Criação do roteador para os convites
export const invite = express.Router();

/**
 * @route   POST /api/v1/invite
 * @desc    Cria um novo convite para uma propriedade.
 * @access  Privado (requer autenticação e permissão de 'proprietario_master')
 */
invite.post('/', protect, createInvite);

/**
 * @route   GET /api/v1/invite/verify/:token
 * @desc    Verifica a validade de um token de convite.
 * @access  Público
 */
invite.get('/verify/:token', verifyInvite);

/**
 * @route   POST /api/v1/invite/accept/:token
 * @desc    Aceita um convite, vinculando o usuário autenticado à propriedade.
 * @access  Privado (requer autenticação)
 */
invite.post('/accept/:token', protect, acceptInvite);


invite.get('/property/:propertyId/pending', protect, getPendingByProperty);