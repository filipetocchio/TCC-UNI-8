import express from "express";
import { getUser } from "../controllers/User/get.User.controller";
import { getUserById } from "../controllers/User/getById.User.controller";
import { updateUser } from "../controllers/User/update.User.controller";
import { deleteUser } from "../controllers/User/delete.User.controller";
import { deleteUserById } from "../controllers/User/deleteById.User.controller";
import { uploadProfile } from "../middleware/upload"; 

export const user = express.Router();

user.get("/", getUser);
user.get("/:id", getUserById);
user.put("/:id", updateUser);
user.delete("/", deleteUser);
user.delete("/:id", deleteUserById);

// Rota com upload de imagem (fotoPerfil)
user.put("/upload/:id", uploadProfile.single("fotoPerfil"), updateUser);
