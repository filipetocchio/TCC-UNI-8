// Todos direitos autorais reservados pelo QOTA.

import { Router } from 'express';

// Importação única para cada módulo de rota.
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
import { financial } from './financial.route';
import { notification } from './notification.route';

export const apiV1Router = Router();

// Registro único para cada roteador.
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
apiV1Router.use("/financial", financial);
apiV1Router.use("/notification", notification);