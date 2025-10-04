// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validar o ID do documento que vem pela URL
const getDocumentByIdSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'O ID do documento é inválido.' }),
});

export const getPropertyDocumentsById = async (req: Request, res: Response) => {
  try {
    const { id } = getDocumentByIdSchema.parse(req.params);

    const documento = await prisma.documentosPropriedade.findUnique({
      where: { id },
      include: {
        propriedade: {
          select: {
            id: true,
            nomePropriedade: true,
          },
        },
      },
    });

    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
    }

    return res.status(200).json({ success: true, data: documento });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    console.error('Erro ao buscar documento por ID:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};