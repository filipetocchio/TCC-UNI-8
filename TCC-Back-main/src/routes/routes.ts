// Todos direitos autorais reservados pelo QOTA.

/**
 * @file routes.ts
 * @description Ponto de entrada principal para todas as rotas da API versão 1 (v1).
 * Este arquivo importa e agrega todos os roteadores de módulos específicos
 * sob o prefixo global /api/v1.
 */

import { Router } from 'express';

// Importação de todos os roteadores de módulos da aplicação.
import { auth } from './auth.route';
import { user } from './user.route';
import { property } from './property.route';
import { permission } from './permission.route';
import { propertyDocuments } from './propertyDocuments.route';
import { propertyPhoto } from './propertyPhoto.route';
import { inventory } from './inventory.route';
import { inventoryPhoto } from './inventoryPhoto.route';
import { invite } from './invite.route';
import { validation } from './validation.route';
import { notification } from './notification.route';

// Inicializa o roteador principal para a v1 da API.
export const apiV1Router = Router();

// Registro de cada módulo em seu respectivo endpoint base.
apiV1Router.use("/auth", auth);
apiV1Router.use("/user", user);
apiV1Router.use("/property", property);
apiV1Router.use("/permission", permission);
apiV1Router.use("/propertyDocuments", propertyDocuments);
apiV1Router.use("/propertyPhoto", propertyPhoto);
apiV1Router.use("/inventory", inventory);
apiV1Router.use("/inventoryPhoto", inventoryPhoto);
apiV1Router.use("/invite", invite);
apiV1Router.use("/validation", validation);
apiV1Router.use("/notification", notification);
