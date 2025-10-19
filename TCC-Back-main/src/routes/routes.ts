// Todos direitos autorais reservados pelo QOTA.

/**
 * Roteador Principal da API (v1)
 *
 * Descrição:
 * Este arquivo é o ponto de entrada (entry point) para todas as rotas da versão 1
 * da API. Ele funciona como um agregador central, importando os roteadores de
 * cada módulo específico da aplicação (autenticação, usuários, propriedades, etc.)
 * e montando-os sob o prefixo global `/api/v1`.
 *
 * Manter essa estrutura modular facilita a manutenção, a escalabilidade e a
 * organização geral do código.
 */
import { Router } from 'express';

// Importação de todos os roteadores de módulos da aplicação.
import { auth } from './auth.route';
import { calendar } from './calendar.route';
import { financial } from './financial.route';
import { inventory } from './inventory.route';
import { inventoryPhoto } from './inventoryPhoto.route';
import { invite } from './invite.route';
import { notification } from './notification.route';
import { permission } from './permission.route';
import { property } from './property.route';
import { propertyDocuments } from './propertyDocuments.route';
import { propertyPhoto } from './propertyPhoto.route';
import { user } from './user.route';
import { validation } from './validation.route';

// Inicializa o roteador principal para a v1 da API.
export const apiV1Router = Router();

// --- Agregação dos Módulos da API ---
// Cada módulo da aplicação é registrado em seu respectivo endpoint base.
// A ordem alfabética facilita a localização das rotas.
apiV1Router.use('/auth', auth);                         // Rotas de autenticação (login, registro, etc.).
apiV1Router.use('/calendar', calendar);                 // Rotas do módulo de calendário e reservas.
apiV1Router.use('/financial', financial);               // Rotas do módulo financeiro (despesas, pagamentos, etc.).
apiV1Router.use('/inventory', inventory);               // Rotas para o inventário de uma propriedade.
apiV1Router.use('/inventoryPhoto', inventoryPhoto);     // Rotas para as fotos dos itens de inventário.
apiV1Router.use('/invite', invite);                     // Rotas para o sistema de convites.
apiV1Router.use('/notification', notification);         // Rotas para o sistema de notificações.
apiV1Router.use('/permission', permission);             // Rotas para gerenciamento de permissões e vínculos.
apiV1Router.use('/property', property);                 // Rotas para o gerenciamento de propriedades (CRUD).
apiV1Router.use('/propertyDocuments', propertyDocuments); // Rotas para os documentos de uma propriedade.
apiV1Router.use('/propertyPhoto', propertyPhoto);       // Rotas para as fotos de uma propriedade.
apiV1Router.use('/user', user);                         // Rotas para o gerenciamento de usuários.
apiV1Router.use('/validation', validation);             // Rotas para serviços de validação (ex: OCR).