// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Notificações
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * sistema de notificações. Cada rota é associada ao seu respectivo controlador
 * e protegida pelo middleware de autenticação.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { getNotificationsByProperty } from '../controllers/Notification/get.Notification.controller';
import { markNotificationsAsRead } from '../controllers/Notification/update.Notification.controller';

// Criação do roteador para o escopo de notificações.
export const notification = express.Router();

// Rota para buscar todas as notificações de uma propriedade específica.
// Acesso: Privado. A autorização (ser membro da propriedade) é tratada no controlador.
notification.get('/property/:propertyId', protect, getNotificationsByProperty);

// Rota para marcar um conjunto de notificações como lidas para o usuário logado.
// Acesso: Privado. A ação é inerentemente segura, pois só afeta o usuário autenticado.
notification.put('/read', protect, markNotificationsAsRead);