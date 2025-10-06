// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { createNotification } from '../../utils/notification.service';

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

/**
 * Exclui um documento de propriedade específico por seu ID e notifica
 * os membros sobre a remoção.
 */
export const deletePropertyDocumentsById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { id } = deleteDocumentByIdSchema.parse(req.params);

    const documento = await prisma.documentosPropriedade.findUnique({
      where: { id },
      include: {
          propriedade: { select: { nomePropriedade: true } }, // Inclui o nome da propriedade para a notificação
      },
    });

    if (!documento) {
      return res.status(404).json({ success: false, message: `Documento com ID ${id} não encontrado.` });
    }

    // Tenta remover o arquivo físico do servidor.
    const filePath = path.join(__dirname, '../../../uploads', path.basename(documento.documento));
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      // A falha na exclusão do arquivo não deve impedir a operação, mas é registrada.
      console.error(`Falha ao deletar o arquivo físico ${filePath}:`, fileError);
    }

    await prisma.documentosPropriedade.delete({
      where: { id },
    });

    // 2. CRIA A NOTIFICAÇÃO
    await createNotification({
        idPropriedade: documento.idPropriedade,
        idAutor: userId,
        mensagem: `O usuário '${userName}' removeu o documento '${documento.tipoDocumento}' da propriedade '${documento.propriedade.nomePropriedade}'.`,
    });

    return res.status(200).json({ success: true, message: `Documento deletado com sucesso.` });
  } catch (error) {
    if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao deletar o documento.' });
  }
};