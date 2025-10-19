// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas do Módulo de Calendário
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * módulo de calendário. Isso inclui o gerenciamento completo do ciclo de vida
 * das reservas (criação, consulta, cancelamento), os processos de check-in e
 * check-out, a consulta de históricos e a configuração das regras de agendamento.
 *
 * Todas as rotas são protegidas e a autorização granular (verificar se o usuário
 * pertence à propriedade, se é o dono da reserva, etc.) é tratada dentro de
 * cada controlador.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';

// Importação dos controladores do módulo de calendário
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

// Criação do roteador para o escopo de calendário.
export const calendar = express.Router();


// --- Rotas de Gerenciamento de Reservas (CRUD) ---

// Rota para criar uma nova reserva para o usuário autenticado.
// Acesso: Privado.
calendar.post('/reservation', protect, createReservation);

// Rota para buscar os detalhes de uma reserva específica.
// Acesso: Privado.
calendar.get('/reservation/:reservationId', protect, getReservationById);

// Rota para cancelar uma reserva.
// Acesso: Privado.
calendar.delete('/reservation/:reservationId', protect, cancelReservation);


// --- Rotas de Ações (Check-in / Check-out) ---

// Rota para registrar o check-in de uma reserva com o checklist do inventário.
// Acesso: Privado.
calendar.post('/checkin', protect, performCheckin);

// Rota para registrar o check-out de uma reserva.
// Acesso: Privado.
calendar.post('/checkout', protect, performCheckout);


// --- Rotas de Consulta e Visualização por Propriedade ---

// Rota para buscar as próximas reservas de uma propriedade.
// Acesso: Privado.
calendar.get('/property/:propertyId/upcoming', protect, getUpcomingReservations);

// Rota para buscar as reservas já concluídas de uma propriedade.
// Acesso: Privado.
calendar.get('/property/:propertyId/completed', protect, getCompletedReservations);

// Rota para buscar as penalidades ativas de uma propriedade.
// Acesso: Privado.
calendar.get('/property/:propertyId/penalties', protect, getPenaltiesByProperty);

// Rota para buscar todas as reservas de uma propriedade (para o calendário principal).
// Deve ser uma das últimas rotas com este prefixo para evitar conflitos.
// Acesso: Privado.
calendar.get('/property/:propertyId', protect, getReservationsByProperty);


// --- Rotas de Configuração (Apenas para Master) ---

// Rota para atualizar as regras de agendamento de uma propriedade.
// Acesso: Privado (autorização de 'proprietario_master' é tratada no controlador).
calendar.put('/rules/:propertyId', protect, updateSchedulingRules);