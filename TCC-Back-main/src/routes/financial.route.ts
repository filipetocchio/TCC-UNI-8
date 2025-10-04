// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/authMiddleware';
import { uploadInvoice } from '../controllers/Financial/upload.Financial.controller';

// Configura o multer para receber o arquivo em memória, pois apenas o encaminharemos.
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // Limite de 10MB

export const financial = express.Router();

/**
 * @route   POST /api/v1/financial/upload-invoice
 * @desc    Recebe um arquivo de conta, extrai os dados via OCR e salva no banco.
 * @access  Privado (requer autenticação)
 */
financial.post('/upload-invoice', protect, upload.single('invoiceFile'), uploadInvoice);