import express from "express";
import { linkUserPermission } from "../controllers/Permission/usersToProperty.Permission.controller";
import { getUsuariosPropriedades } from "../controllers/Permission/get.Permission.controller";
import { getByIDsuariosPropriedades } from "../controllers/Permission/getById.Permission.controller";
import { getPropertyUsersPermission } from "../controllers/Permission/getPropertyUsers.Permission.controller";
import { getUserPropertiesPermission } from "../controllers/Permission/getUserProperties.Permission.controller";
import { updateUserPermission } from "../controllers/Permission/updateUser.Permission.controller";
import { removeUserFromPropertyPermission } from "../controllers/Permission/removeUserFromProperty.Permission.controller";
import { removeUserFromPropertyPermissionById } from "../controllers/Permission/removeUserFromPropertyById.Permission.controller";

export const permission = express.Router();

permission.post("/addUser", linkUserPermission);
permission.get("/", getUsuariosPropriedades)
permission.get("/:id", getByIDsuariosPropriedades)                                                    
permission.get("/getPropertyUsers/:id", getPropertyUsersPermission);
permission.get("/getUserProperties/:id", getUserPropertiesPermission);
permission.put("/updateUser", updateUserPermission);
permission.delete("/", removeUserFromPropertyPermission);
permission.delete("/:id", removeUserFromPropertyPermissionById);