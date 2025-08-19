import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 1) Schema Zod para validar e normalizar o tipoDocumento
const uploadDocumentSchema = z.object({
  idPropriedade: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).pipe(z.number().int().positive()),
  tipoDocumento: z
    .string()
    .transform((val) => val.replace(/_/g, ' ')) // converte underline em espaço
    .pipe(
      z.enum(['IPTU', 'Matricula', 'Conta de Luz', 'Outros'], {
        errorMap: () => ({
          message:
            'Tipo de documento inválido. Use "IPTU", "Matricula", "Conta de Luz" ou "Outros"',
        }),
      })
    ),
});

// 2) Storage Multer: documentos em pasta específica
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(__dirname, '../../../uploads/documents');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `doc-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// 3) Filtro de tipos permitidos
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF ou imagens (PNG/JPEG) são permitidos como documento'));
  }
};

// 4) Instância do Multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // até 10MB
}).single('documento');

// 5) Controller
const UploadPropertyDocuments = (req: Request, res: Response) => {
  upload(req, res, async (err) => {
    // 5.1 Erros do Multer
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Multer: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum documento enviado' });
    }

    // 5.2 Parse e validação via Zod (com transform)
    let parsed: z.infer<typeof uploadDocumentSchema>;
    try {
      parsed = uploadDocumentSchema.parse(req.body);
    } catch (zErr) {
      // remove arquivo se invalidar
      fs.unlinkSync(req.file.path);
      if (zErr instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Dados inválidos',
          details: zErr.issues,
        });
      }
      return res.status(500).json({ success: false, error: 'Erro interno ao validar dados' });
    }

    const { idPropriedade, tipoDocumento } = parsed;

    // 5.3 Verifica existência da propriedade
    try {
      const propriedade = await prisma.propriedades.findUnique({
        where: { id: idPropriedade },
      });
      if (!propriedade) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, error: `Propriedade ${idPropriedade} não encontrada` });
      }
    } catch (dbErr) {
      console.error('Erro ao buscar propriedade:', dbErr);
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ success: false, error: 'Erro ao buscar propriedade' });
    }

    // 5.4 Persiste no banco
    try {
      const documento = await prisma.documentosPropriedade.create({
        data: {
          idPropriedade,
          tipoDocumento,
          documento: `/uploads/documents/${req.file.filename}`,
          dataUpload: new Date(),
        },
      });
      return res.status(201).json({ success: true, data: documento });
    } catch (saveErr) {
      console.error('Erro ao salvar documento:', saveErr);
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ success: false, error: 'Erro ao salvar documento' });
    }
  });
};

export { UploadPropertyDocuments };
