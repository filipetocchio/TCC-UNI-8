import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getDocumentByIdSchema = z.object({
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

const getPropertyDocumentsById = async (req: Request, res: Response) => {
  try {
    const parsedParams = getDocumentByIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.success === false ? parsedParams.error.errors : [] });
    }

    const { id } = parsedParams.data;

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
      return res.status(404).json({ error: `Documento com ID ${id} não encontrado` });
    }

    return res.status(200).json(documento);
  } catch (error) {
    console.error('Erro ao buscar documento por ID:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { getPropertyDocumentsById };