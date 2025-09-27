// D:\Qota - TCC\TCC-Back_End\TCC-Back\src\routes\inventory.route.ts
// Todos direitos autorais reservados pelo QOTA.

import express from "express";
import { createInventoryItem } from "../controllers/Inventory/create.Inventory.controller";
import { getInventoryByProperty } from "../controllers/Inventory/getByProperty.Inventory.controller";
import { updateInventoryItem } from "../controllers/Inventory/update.Inventory.controller";
import { deleteInventoryItemById } from "../controllers/Inventory/deleteById.Inventory.controller";

// Inicializa o roteador do Express
export const inventory = express.Router();

// Rota para criar um novo item no inventário
// Ex: POST /api/v1/inventory/create
inventory.post("/create", createInventoryItem);

// Rota para listar todos os itens de uma propriedade específica
// Ex: GET /api/v1/inventory/property/123
inventory.get("/property/:propertyId", getInventoryByProperty);

// Rota para atualizar um item específico pelo seu ID
// Ex: PUT /api/v1/inventory/456
inventory.put("/:id", updateInventoryItem);

// Rota para deletar (soft delete) um item específico pelo seu ID
// Ex: DELETE /api/v1/inventory/456
inventory.delete("/:id", deleteInventoryItemById);