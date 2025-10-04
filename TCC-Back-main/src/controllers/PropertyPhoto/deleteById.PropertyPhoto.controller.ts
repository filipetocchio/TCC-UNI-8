// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const deletePhotoByIdSchema = z.object({
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

// O nome da função foi corrigido aqui
export const deletePropertyPhotoById = async (req: Request, res: Response) => {
  try {
    const parsedParams = deletePhotoByIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    const { id } = parsedParams.data;

    const foto = await prisma.fotosPropriedade.findUnique({
      where: { id },
    });

    if (!foto) {
      return res.status(404).json({ error: `Foto com ID ${id} não encontrada` });
    }

    const filePath = path.join(__dirname, '../../../', foto.documento);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.error(`Erro ao deletar arquivo ${filePath}:`, fileError);
    }

    await prisma.fotosPropriedade.delete({
      where: { id },
    });

    return res.status(200).json({ message: `Foto com ID ${id} deletada com sucesso` });
  } catch (error) {
    console.error('Erro ao deletar foto por ID:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};