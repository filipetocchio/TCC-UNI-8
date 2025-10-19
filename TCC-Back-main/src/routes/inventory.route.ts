// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Inventário
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * gerenciamento de itens de inventário (CRUD completo), associando cada endpoint
 * ao seu respectivo controlador e aplicando o middleware de autenticação.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { createInventoryItem } from '../controllers/Inventory/create.Inventory.controller';
import { getInventoryByProperty } from '../controllers/Inventory/getByProperty.Inventory.controller';
import { getInventoryItemById } from '../controllers/Inventory/getById.Inventory.controller';
import { updateInventoryItem } from '../controllers/Inventory/update.Inventory.controller';
import { deleteInventoryItemById } from '../controllers/Inventory/deleteById.Inventory.controller';

export const inventory = express.Router();

// Rota para criar um novo item no inventário de uma propriedade.
// Acesso: Privado.
inventory.post('/create', protect, createInventoryItem);

// Rota para listar todos os itens de inventário de uma propriedade específica.
// Acesso: Privado.
inventory.get('/property/:propertyId', protect, getInventoryByProperty);

// Rota para buscar um item de inventário específico pelo seu ID.
// Acesso: Privado.
inventory.get('/:id', protect, getInventoryItemById);

// Rota para atualizar os dados de um item de inventário específico.
// Acesso: Privado.
inventory.put('/:id', protect, updateInventoryItem);

// Rota para realizar o soft-delete de um item de inventário específico.
// Acesso: Privado.
inventory.delete('/:id', protect, deleteInventoryItemById);