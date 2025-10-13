// Todos direitos autorais reservados pelo QOTA.

/**
 * @file calendar.route.ts
 * @description Define as rotas da API para o gerenciamento completo do Módulo de Calendário,
 * incluindo reservas, checklists, regras e consultas de histórico.
 */

import express from 'express';
import { protect } from '../middleware/authMiddleware';

// Importação de todos os controllers do Módulo de Calendário
import { createReservation } from '../controllers/Calendar/create.Reservation.controller';
import { getReservationsByProperty } from '../controllers/Calendar/getByProperty.Reservations.controller';
import { getReservationById } from '../controllers/Calendar/getById.Reservation.controller';
import { cancelReservation } from '../controllers/Calendar/cancel.Reservation.controller';
import { performCheckin } from '../controllers/Calendar/checkin.Reservation.controller';
import { performCheckout } from '../controllers/Calendar/checkout.Reservation.controller';
import { updateSchedulingRules } from '../controllers/Calendar/update.Rules.controller';
import { getPenaltiesByProperty } from '../controllers/Calendar/get.Penalties.controller';
import { getUpcomingReservations } from '../controllers/Calendar/get.UpcomingReservations.controller';
import { getCompletedReservations } from '../controllers/Calendar/get.CompletedReservations.controller';


export const calendar = express.Router();

// --- Rotas de Gerenciamento de Reservas (CRUD) ---

/**
 * @route   POST /api/v1/calendar/reservation
 * @desc    Cria uma nova reserva para o usuário autenticado.
 * @access  Privado
 */
calendar.post('/reservation', protect, createReservation);

/**
 * @route   GET /api/v1/calendar/reservation/:reservationId
 * @desc    Busca os detalhes de uma reserva específica.
 * @access  Privado
 */
calendar.get('/reservation/:reservationId', protect, getReservationById);

/**
 * @route   DELETE /api/v1/calendar/reservation/:reservationId
 * @desc    Cancela uma reserva.
 * @access  Privado
 */
calendar.delete('/reservation/:reservationId', protect, cancelReservation);


// --- Rotas de Ações (Check-in / Check-out) ---

/**
 * @route   POST /api/v1/calendar/checkin
 * @desc    Registra o check-in de uma reserva com o checklist do inventário.
 * @access  Privado
 */
calendar.post('/checkin', protect, performCheckin);

/**
 * @route   POST /api/v1/calendar/checkout
 * @desc    Registra o check-out de uma reserva e a conclui.
 * @access  Privado
 */
calendar.post('/checkout', protect, performCheckout);


// --- Rotas de Consulta e Visualização ---

/**
 * @route   GET /api/v1/calendar/property/:propertyId
 * @desc    Busca todas as reservas de uma propriedade dentro de um período (para o calendário principal).
 * @access  Privado
 */
calendar.get('/property/:propertyId', protect, getReservationsByProperty);

/**
 * @route   GET /api/v1/calendar/property/:propertyId/upcoming
 * @desc    Busca as próximas reservas de uma propriedade.
 * @access  Privado
 */
calendar.get('/property/:propertyId/upcoming', protect, getUpcomingReservations);

/**
 * @route   GET /api/v1/calendar/property/:propertyId/completed
 * @desc    Busca as reservas já concluídas de uma propriedade.
 * @access  Privado
 */
calendar.get('/property/:propertyId/completed', protect, getCompletedReservations);

/**
 * @route   GET /api/v1/calendar/property/:propertyId/penalties
 * @desc    Busca as penalidades ativas de uma propriedade.
 * @access  Privado
 */
calendar.get('/property/:propertyId/penalties', protect, getPenaltiesByProperty);


// --- Rotas de Configuração (Apenas para Master) ---

/**
 * @route   PUT /api/v1/calendar/rules/:propertyId
 * @desc    Atualiza as regras de agendamento de uma propriedade.
 * @access  Privado (Acesso restrito a 'proprietario_master' no controller)
 */
calendar.put('/rules/:propertyId', protect, updateSchedulingRules);
