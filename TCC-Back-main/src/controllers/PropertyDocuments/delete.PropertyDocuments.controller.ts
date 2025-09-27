// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const deletePropertyDocuments = async (req: Request, res: Response) => {
  try {
    const documentos = await prisma.documentosPropriedade.findMany();

    if (documentos.length === 0) {
      return res.status(200).json({ message: 'Nenhum documento para deletar' });
    }

    for (const documento of documentos) {
      const filePath = path.join(__dirname, '../../../', documento.documento);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error(`Erro ao deletar arquivo ${filePath}:`, fileError);
      }
    }

    await prisma.documentosPropriedade.deleteMany();

    return res.status(200).json({ message: 'Todos os documentos foram deletados com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar documentos:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { deletePropertyDocuments };