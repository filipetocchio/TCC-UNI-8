// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createNotification } from '../../utils/notification.service';


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

/**
 * Controller para o upload de uma foto de propriedade.
 * Inclui a criação de uma notificação para registrar a atividade.
 */
const UploadPropertyPhoto = (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: "Usuário não autenticado." });
      }
      const { id: userId, nomeCompleto: userName } = req.user;

      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Erro no upload: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo de foto foi enviado.' });
      }

      const { idPropriedade } = uploadPhotoSchema.parse(req.body);

      const propriedade = await prisma.propriedades.findUnique({
        where: { id: idPropriedade }
      });
      if (!propriedade) {
        return res.status(404).json({ error: `Propriedade com ID ${idPropriedade} não encontrada.` });
      }

      const foto = await prisma.fotosPropriedade.create({
        data: {
          idPropriedade,
          documento: `/uploads/${req.file.filename}`,
          dataUpload: new Date()
        },
      });

      // 5. CRIA A NOTIFICAÇÃO
      await createNotification({
        idPropriedade,
        idAutor: userId,
        mensagem: `O usuário '${userName}' adicionou uma nova foto à propriedade '${propriedade.nomePropriedade}'.`,
      });

      return res.status(201).json(foto);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.issues[0].message });
      }
      return res.status(500).json({ success: false, message: 'Erro interno ao salvar a foto.' });
    }
  });
};

export { UploadPropertyPhoto };