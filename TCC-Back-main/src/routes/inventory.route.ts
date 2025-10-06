// Todos direitos autorais reservados pelo QOTA.

/**
 * @file inventory.route.ts
 * @description Define as rotas da API para o gerenciamento completo (CRUD)
 * do inventário de uma propriedade.
 */

import express from "express";
import { protect } from '../middleware/authMiddleware';
import { createInventoryItem } from "../controllers/Inventory/create.Inventory.controller";
import { getInventoryByProperty } from "../controllers/Inventory/getByProperty.Inventory.controller";
import { getInventoryItemById } from "../controllers/Inventory/getById.Inventory.controller";
import { updateInventoryItem } from "../controllers/Inventory/update.Inventory.controller";
import { deleteInventoryItemById } from "../controllers/Inventory/deleteById.Inventory.controller";

export const inventory = express.Router();

/**
 * @route   POST /api/v1/inventory/create
 * @desc    Cria um novo item no inventário de uma propriedade.
 * @access  Privado
 */
inventory.post("/create", protect, createInventoryItem);

/**
 * @route   GET /api/v1/inventory/property/:propertyId
 * @desc    Lista todos os itens de inventário ativos de uma propriedade específica.
 * @access  Privado
 */
inventory.get("/property/:propertyId", protect, getInventoryByProperty);

/**
 * @route   GET /api/v1/inventory/:id
 * @desc    Busca um item de inventário específico pelo seu ID.
 * @access  Privado
 */
inventory.get("/:id", protect, getInventoryItemById);

/**
 * @route   PUT /api/v1/inventory/:id
 * @desc    Atualiza os dados de um item de inventário específico.
 * @access  Privado
 */
inventory.put("/:id", protect, updateInventoryItem);

/**
 * @route   DELETE /api/v1/inventory/:id
 * @desc    Realiza o soft-delete de um item de inventário específico.
 * @access  Privado
 */
inventory.delete("/:id", protect, deleteInventoryItemById);
