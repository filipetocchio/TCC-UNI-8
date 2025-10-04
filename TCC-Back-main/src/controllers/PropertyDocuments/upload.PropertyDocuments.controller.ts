// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const uploadSchema = z.object({
  idPropriedade: z.string().transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'O ID da propriedade é inválido.' }),
  tipoDocumento: z.string().min(1, { message: 'O tipo do documento é obrigatório.' }),
});

export const uploadPropertyDocument = async (req: Request, res: Response) => {
  try {
    const { idPropriedade, tipoDocumento } = uploadSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de documento foi enviado.' });
    }

    const propertyExists = await prisma.propriedades.findUnique({ where: { id: idPropriedade } });
    if (!propertyExists) {
      return res.status(404).json({ success: false, message: 'Propriedade não encontrada.' });
    }

    const { filename } = req.file;
    const url = `/uploads/documents/${filename}`;

    const newDocument = await prisma.documentosPropriedade.create({
      data: {
        idPropriedade,
        tipoDocumento,
        documento: url,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Documento enviado com sucesso.',
      data: newDocument,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error("Erro no upload de documento:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};