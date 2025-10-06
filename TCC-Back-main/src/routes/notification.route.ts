// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { getNotificationsByProperty } from '../controllers/Notification/get.Notification.controller';
import { markNotificationsAsRead } from '../controllers/Notification/update.Notification.controller';

export const notification = express.Router();

/**
 * @route   GET /api/v1/notification/property/:propertyId
 * @desc    Busca todas as notificações de uma propriedade específica.
 * @access  Privado
 */
notification.get('/property/:propertyId', protect, getNotificationsByProperty);

/**
 * @route   PUT /api/v1/notification/read
 * @desc    Marca um conjunto de notificações como lidas para o usuário logado.
 * @access  Privado
 */
notification.put('/read', protect, markNotificationsAsRead);