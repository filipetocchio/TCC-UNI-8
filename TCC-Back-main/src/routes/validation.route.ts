// Todos direitos autorais reservados pelo QOTA.

import express, { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { protect } from '../middleware/authMiddleware';
import { validateAddressDocument } from '../controllers/Validation/validateAddress.controller';

// Função de filtro para aceitar apenas PDFs
const pdfFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo inválido. Apenas PDFs são aceitos.'));
  }
};

const storage = multer.memoryStorage();
// Adiciona o fileFilter à configuração do multer
const upload = multer({ storage, fileFilter: pdfFilter, limits: { fileSize: 5 * 1024 * 1024 } });

export const validation = express.Router();

validation.post('/address', protect, upload.single('documento'), validateAddressDocument);