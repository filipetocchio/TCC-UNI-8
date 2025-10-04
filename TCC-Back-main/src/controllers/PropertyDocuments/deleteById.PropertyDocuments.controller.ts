// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const deleteDocumentByIdSchema = z.object({
  id: z.string().transform((val, ctx) => {
    const parsed = parseInt(val);
    if (isNaN(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ID deve ser um número inteiro positivo',
      });
      return z.NEVER;
    }
    return parsed;
  }),
});

export const deletePropertyDocumentsById = async (req: Request, res: Response) => {
  try {
    const parsedParams = deleteDocumentByIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    const { id } = parsedParams.data;

    const documento = await prisma.documentosPropriedade.findUnique({
      where: { id },
    });

    if (!documento) {
      return res.status(404).json({ error: `Documento com ID ${id} não encontrado` });
    }

    const filePath = path.join(__dirname, '../../../', documento.documento);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error(`Erro ao deletar arquivo ${filePath}:`, fileError);
    }

    await prisma.documentosPropriedade.delete({
      where: { id },
    });

    return res.status(200).json({ message: `Documento com ID ${id} deletado com sucesso` });
  } catch (error) {
    console.error('Erro ao deletar documento por ID:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};