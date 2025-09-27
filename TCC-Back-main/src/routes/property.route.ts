// Todos direitos autorais reservados pelo QOTA.


import express from "express";
import { createProperty } from "../controllers/Property/create.Property.controller";
import { getProperty } from "../controllers/Property/get.Property.controller";
import { getPropertyById } from "../controllers/Property/getById.Property.controller";
import { updateProperty } from "../controllers/Property/update.Property.controller";
import { deleteProperty } from "../controllers/Property/delete.Property.controller";
import { deletePropertyById } from "../controllers/Property/deleteById.Property.controller";

export const property = express.Router();

property.post("/create", createProperty);
property.get("/", getProperty);
property.get("/:id", getPropertyById);
property.put("/:id", updateProperty);

property.delete("/", deleteProperty);
property.delete("/:id", deletePropertyById);