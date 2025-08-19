import express from "express";
import { registerAuth } from "../controllers/Auth/register.controller";
import { loginAuth } from "../controllers/Auth/login.Auth.controller";
import { logoutAuth } from "../controllers/Auth/logout.Auth.controller";
import { refreshTokenAuth } from "../controllers/Auth/refreshToken.Auth.controller";

export const auth = express.Router();

auth.post("/register", registerAuth);
auth.post("/login", loginAuth);

auth.post("/logout", logoutAuth);
auth.post("/refresh", refreshTokenAuth);