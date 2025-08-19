import { Router } from 'express';

import { auth } from './auth.route';
import { user } from './user.route';
import { property } from './property.route';
import { permission } from './permission.route';
import { propertyDocuments } from './propertyDocuments.route';
import { propertyPhoto } from './propertyPhoto.route';
import { inventory } from './inventory.route';
import { inventoryPhoto } from './inventoryPhoto.route';

export const apiV1Router = Router();

apiV1Router.use("/auth", auth);
apiV1Router.use("/user", user);
apiV1Router.use("/property", property);
apiV1Router.use("/permission", permission);
apiV1Router.use("/propertyDocuments", propertyDocuments);
apiV1Router.use("/propertyPhoto", propertyPhoto);
apiV1Router.use("/inventory", inventory);
apiV1Router.use("/inventoryPhoto", inventoryPhoto);