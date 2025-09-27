// Todos direitos autorais reservados pelo QOTA.


/**
 * @file upload.ts
 * @description Centraliza as configurações do Multer para o tratamento de uploads de arquivos.
 * Utiliza um padrão de fábrica (factory pattern) para criar configurações de armazenamento
 * de forma escalável e reutilizável.
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * @function ensureDirSync
 * @description Função utilitária que verifica se um diretório existe e, caso não, o cria.
 * @param {string} dirPath - O caminho do diretório a ser verificado/criado.
 */
const ensureDirSync = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * @function createStorage
 * @description Factory function para criar configurações de armazenamento do Multer.
 * Esta abordagem centraliza a lógica de criação de diretório e nomeação de arquivos,
 * tornando o middleware mais limpo e fácil de estender para novos tipos de upload.
 * @param {string} destination - A subpasta dentro de 'uploads' onde os arquivos serão salvos.
 * @param {string} filenamePrefix - O prefixo para o nome do arquivo.
 * @returns {multer.StorageEngine} A configuração de armazenamento para o Multer.
 */
const createStorage = (destination: string, filenamePrefix: string): multer.StorageEngine => {
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
 * @description Instâncias do Multer exportadas para serem usadas como middleware nas rotas.
 * Cada instância é criada pela factory 'createStorage', garantindo consistência e organização.
 */
export const uploadProfile = multer({ storage: createStorage('profile', 'user-profile') });
export const uploadInventory = multer({ storage: createStorage('inventory', 'inventory-item') });
export const uploadDocument = multer({ storage: createStorage('documents', 'property-document') });

