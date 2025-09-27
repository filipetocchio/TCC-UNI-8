// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const getPhotoByIdSchema = z.object({
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

const getPropertyPhotoById = async (req: Request, res: Response) => {
  try {
    const parsedParams = getPhotoByIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.success === false ? parsedParams.error.errors : [] });
    }

    const { id } = parsedParams.data;

    const foto = await prisma.fotosPropriedade.findUnique({
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

    if (!foto) {
      return res.status(404).json({ error: `Foto com ID ${id} não encontrada` });
    }

    return res.status(200).json(foto);
  } catch (error) {
    console.error('Erro ao buscar foto por ID:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { getPropertyPhotoById };