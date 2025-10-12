// Todos direitos autorais reservados pelo QOTA.

/**
 * @file upload.ts
 * @description Centraliza as configurações do Multer para o tratamento de uploads de arquivos,
 * oferecendo middlewares para salvar em disco e para processar em memória.
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

/**
 * Garante que um diretório exista, criando-o de forma recursiva se necessário.
 * @param {string} dirPath - O caminho do diretório a ser verificado/criado.
 */
const ensureDirSync = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Função de fábrica para criar configurações de armazenamento em disco para o Multer.
 * @param {string} destination - A subpasta dentro de 'uploads' onde os arquivos serão salvos.
 * @param {string} filenamePrefix - O prefixo para o nome do arquivo.
 * @returns {multer.StorageEngine} A configuração de armazenamento em disco.
 */
const createDiskStorage = (destination: string, filenamePrefix: string): multer.StorageEngine => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.resolve(__dirname, '..', '..', 'uploads', destination);
      ensureDirSync(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `${filenamePrefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });
};

/**
 * Filtro de arquivos para validar os tipos de arquivo permitidos no upload.
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Aceita apenas PDFs e os principais formatos de imagem.
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype === 'application/pdf'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado. Apenas imagens e PDFs são permitidos.'));
  }
};

// --- Middlewares Exportados ---

/**
 * Middleware para uploads que serão salvos em disco.
 */
export const uploadProfile = multer({ storage: createDiskStorage('profile', 'user-profile') });
export const uploadInventory = multer({ storage: createDiskStorage('inventory', 'inventory-item') });
export const uploadDocument = multer({ storage: createDiskStorage('documents', 'property-document') });
export const uploadPropertyPhoto = multer({ storage: createDiskStorage('property', 'property-photo') }); 
export const uploadInvoiceReceipt = multer({ storage: createDiskStorage('invoices', 'invoice-receipt'), fileFilter });

/**
 * Middleware para uploads que serão processados em memória.
 * Ideal para manipulação de arquivos antes do salvamento, como no fluxo de OCR.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10MB por arquivo
  },
});
