// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição da Rota de Validação
 *
 * Descrição:
 * Este arquivo define a rota para o endpoint de validação de endereço.
 * A rota é protegida e utiliza um middleware de upload customizado para processar
 * o documento (comprovante de endereço) enviado para análise.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { validateAddressDocument } from '../controllers/Validation/validateAddress.controller';
import { uploadPdfForValidation } from '../middleware/upload';

// Criação do roteador para o escopo de validação.
export const validation = express.Router();

// Rota para validar um comprovante de endereço.
// A requisição primeiro passa pela autenticação (`protect`), depois pelo middleware
// de upload (`uploadPdfForValidation`) que processa o arquivo em memória, e
// finalmente chega ao controlador para ser encaminhado ao serviço de OCR.
// Acesso: Privado (requer autenticação).
validation.post(
  '/address',
  protect,
  uploadPdfForValidation.single('documento'),
  validateAddressDocument
);