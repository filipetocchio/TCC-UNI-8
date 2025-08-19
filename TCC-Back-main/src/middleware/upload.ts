/**
 * @file upload.ts
 * @description Centraliza as configurações do Multer para o tratamento de uploads de arquivos.
 * Este middleware é projetado para ser escalável, permitindo a fácil adição de
 * diferentes configurações de armazenamento para diversos tipos de arquivos (ex: perfil,
 * documentos, fotos de inventário).
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * @function ensureDirSync
 * @description Função utilitária que verifica se um diretório existe e, caso não,
 * o cria de forma síncrona e recursiva. Isso previne erros de "diretório
 * não encontrado" durante o salvamento de arquivos pelo Multer.
 * @param {string} dirPath - O caminho do diretório a ser verificado/criado.
 */
const ensureDirSync = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * @name profileStorage
 * @description Configuração de armazenamento do Multer para as fotos de perfil dos usuários.
 * Define o diretório de destino e a lógica para gerar um nome de arquivo único.
 */
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Constrói o caminho absoluto para a pasta de uploads de perfil.
    const uploadPath = path.resolve(__dirname, '..', '..', 'uploads', 'profile');
    ensureDirSync(uploadPath); // Garante que a pasta exista.
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Gera um nome de arquivo único para evitar sobrescrever arquivos existentes.
    // Ex: user-profile-1678886400000-123456789.jpg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'user-profile-' + uniqueSuffix + path.extname(file.originalname));
  },
});

/**
 * @name inventoryStorage
 * @description Configuração de armazenamento do Multer para as fotos de itens de inventário.
 * Salva os arquivos em uma pasta dedicada para manter a organização do projeto.
 */
const inventoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Direciona os arquivos de inventário para a sua própria pasta.
    const uploadPath = path.resolve(__dirname, '..', '..', 'uploads', 'inventory');
    ensureDirSync(uploadPath); // Garante que a pasta exista.
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Utiliza um prefixo diferente para fácil identificação dos arquivos.
    // Ex: inventory-item-1678886400000-987654321.png
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'inventory-item-' + uniqueSuffix + path.extname(file.originalname));
  },
});

/**
 * @description Instâncias do Multer exportadas para serem usadas como middleware nas rotas.
 * Cada instância utiliza uma configuração de armazenamento específica, permitindo
 * que a rota de perfil use `uploadProfile` e a rota de inventário use `uploadInventory`.
 */
export const uploadProfile = multer({ storage: profileStorage });
export const uploadInventory = multer({ storage: inventoryStorage });