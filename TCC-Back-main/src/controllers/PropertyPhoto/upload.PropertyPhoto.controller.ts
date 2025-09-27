// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 1) Schema de validação
const uploadPhotoSchema = z.object({
  idPropriedade: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).pipe(z.number().int().positive()),
});

// 2) Configuração do armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

// 3) Filtro de tipos permitidos
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Apenas JPEG, PNG ou GIF são permitidos'));
};

// 4) Instância do multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single('foto');

// 5) Controller
const UploadPropertyPhoto = (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    // 5.1 Erros de multer
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Multer: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma foto enviada' });
    }

    // 5.2 Parse do body com Zod
    let idPropriedade: number;
    try {
      const parsed = uploadPhotoSchema.parse(req.body);
      idPropriedade = parsed.idPropriedade;
    } catch (parseErr) {
      if (parseErr instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: parseErr.issues
        });
      }
      return res.status(500).json({ error: 'Erro interno ao validar dados' });
    }

    // 5.3 Verifica existência da propriedade
    try {
      const propriedade = await prisma.propriedades.findUnique({
        where: { id: idPropriedade }
      });
      if (!propriedade) {
        return res.status(404).json({ error: `Propriedade ${idPropriedade} não encontrada` });
      }
    } catch (dbErr) {
      console.error(dbErr);
      return res.status(500).json({ error: 'Erro ao buscar propriedade' });
    }

    // 5.4 Cria registro e retorna
    try {
      const foto = await prisma.fotosPropriedade.create({
        data: {
          idPropriedade,
          documento: `/uploads/${req.file.filename}`,
          dataUpload: new Date()
        },
        include: {
          propriedade: {
            select: { id: true, nomePropriedade: true }
          }
        }
      });
      return res.status(201).json({
        id: foto.id,
        idPropriedade: foto.idPropriedade,
        documento: foto.documento,
        dataUpload: foto.dataUpload,
        propriedade: foto.propriedade
      });
    } catch (saveErr) {
      console.error('Erro ao salvar foto:', saveErr);
      return res.status(500).json({ error: 'Erro interno ao salvar foto' });
    }
  });
};

export { UploadPropertyPhoto };
