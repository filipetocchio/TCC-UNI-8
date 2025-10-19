// Todos direitos autorais reservados pelo QOTA.

/**
 * Módulo de Configuração de Uploads (Multer)
 *
 * Descrição:
 * Este arquivo centraliza a configuração do `multer`, o middleware responsável pelo
 * tratamento de uploads de arquivos (`multipart/form-data`) na aplicação.
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// --- Constantes de Configuração ---
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;  // 5MB

// --- Funções Auxiliares de Configuração ---

const ensureDirSync = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createDiskStorage = (destination: string, filenamePrefix: string): multer.StorageEngine => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.resolve(__dirname, '..', '..', 'uploads', destination);
      ensureDirSync(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = path.extname(file.originalname);
      cb(null, `${filenamePrefix}-${uniqueSuffix}${extension}`);
    },
  });
};

// Filtro de arquivos genérico que aceita imagens e PDFs.
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
  if (allowed) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado. Apenas imagens e PDFs são permitidos.'));
  }
};

// Filtro de arquivos específico que aceita apenas PDFs.
const pdfFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo inválido. Apenas PDFs são aceitos.'));
    }
  };

// --- Middlewares de Upload Exportados ---

export const uploadProfile = multer({ storage: createDiskStorage('profile', 'user-profile') });
export const uploadInventory = multer({ storage: createDiskStorage('inventory', 'inventory-item') });
export const uploadDocument = multer({ storage: createDiskStorage('documents', 'property-document') });
export const uploadPropertyPhoto = multer({ storage: createDiskStorage('property', 'property-photo') });
export const uploadInvoiceReceipt = multer({ storage: createDiskStorage('invoices', 'invoice-receipt'), fileFilter });

// Middleware para upload de PDF em memória, usado na validação de endereço.
export const uploadPdfForValidation = multer({
    storage: multer.memoryStorage(),
    fileFilter: pdfFilter,
    limits: { fileSize: MAX_PDF_SIZE_BYTES },
});

// Middleware genérico para uploads em memória (ex: OCR).
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});