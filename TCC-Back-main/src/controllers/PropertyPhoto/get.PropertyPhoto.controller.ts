import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';

const getPropertyPhoto = async (req: Request, res: Response) => {
  try {
    const fotos = await prisma.fotosPropriedade.findMany({
      include: {
        propriedade: {
          select: {
            id: true,
            nomePropriedade: true,
          },
        },
      },
    });

    if (fotos.length === 0) {
      return res.status(200).json({ message: 'Nenhuma foto encontrada', fotos: [] });
    }

    return res.status(200).json(fotos);
  } catch (error) {
    console.error('Erro ao buscar fotos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { getPropertyPhoto };