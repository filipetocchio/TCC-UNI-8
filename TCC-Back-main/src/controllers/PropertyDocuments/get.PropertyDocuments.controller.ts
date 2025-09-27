// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';

const getPropertyDocuments = async (req: Request, res: Response) => {
  try {
    const documentos = await prisma.documentosPropriedade.findMany({
      include: {
        propriedade: {
          select: {
            id: true,
            nomePropriedade: true,
          },
        },
      },
    });

    if (documentos.length === 0) {
      return res.status(200).json({ message: 'Nenhum documento encontrado', documentos: [] });
    }

    return res.status(200).json(documentos);
  } catch (error) {
    console.error('Erro ao buscar documentos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { getPropertyDocuments };