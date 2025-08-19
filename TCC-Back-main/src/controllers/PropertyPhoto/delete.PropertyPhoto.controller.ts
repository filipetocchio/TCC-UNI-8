import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const deletePropertyPhoto = async (req: Request, res: Response) => {
  try {
    const fotos = await prisma.fotosPropriedade.findMany();

    if (fotos.length === 0) {
      return res.status(200).json({ message: 'Nenhuma foto para deletar' });
    }

    for (const foto of fotos) {
      const filePath = path.join(__dirname, '../../../', foto.documento);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error(`Erro ao deletar arquivo ${filePath}:`, fileError);
      }
    }

    await prisma.fotosPropriedade.deleteMany();

    return res.status(200).json({ message: 'Todas as fotos foram deletadas com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar fotos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { deletePropertyPhoto };