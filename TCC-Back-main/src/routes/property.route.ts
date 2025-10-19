// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas de Propriedades
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * gerenciamento principal de propriedades (CRUD). Cada rota é associada ao seu
 * respectivo controlador e protegida com os middlewares de segurança apropriados.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';

// Importação dos controladores de propriedade
import { createProperty } from '../controllers/Property/create.Property.controller';
import { getProperty } from '../controllers/Property/get.Property.controller';
import { getPropertyById } from '../controllers/Property/getById.Property.controller';
import { updateProperty } from '../controllers/Property/update.Property.controller';
import { deletePropertyById } from '../controllers/Property/deleteById.Property.controller';

// Criação do roteador para o escopo de propriedades.
export const property = express.Router();

// Rota para criar uma nova propriedade.
// Acesso: Privado (requer autenticação).
property.post('/create', protect, createProperty);

// Rota para listar todas as propriedades de forma paginada.
// Acesso: Privado (requer autenticação).
property.get('/', protect, getProperty);

// Rota para buscar os detalhes de uma propriedade específica pelo seu ID.
// Acesso: Privado. A autorização (ser membro) é tratada no controlador.
property.get('/:id', protect, getPropertyById);

// Rota para atualizar os dados de uma propriedade específica.
// Acesso: Privado. A autorização (ser master) é tratada no controlador.
property.put('/:id', protect, updateProperty);

// Rota para realizar o soft-delete de uma propriedade específica pelo seu ID.
// Acesso: Privado. A autorização (ser master) é tratada no controlador.
property.delete('/:id', protect, deletePropertyById);