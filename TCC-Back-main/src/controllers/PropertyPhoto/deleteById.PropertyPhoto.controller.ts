// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { createNotification } from '../../utils/notification.service';


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

/**
 * Exclui uma foto de propriedade específica por seu ID e notifica
 * os membros sobre a remoção.
 */
export const deletePropertyPhotoById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { id } = deletePhotoByIdSchema.parse(req.params);

    const foto = await prisma.fotosPropriedade.findUnique({
      where: { id },
      include: {
          propriedade: { select: { nomePropriedade: true } }, // Inclui o nome da propriedade para a notificação
      },
    });

    if (!foto) {
      return res.status(404).json({ success: false, message: `Foto com ID ${id} não encontrada.` });
    }

    const filePath = path.join(__dirname, '../../../', foto.documento);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      // A falha em deletar o arquivo não deve impedir a operação no banco,
      // mas deve ser registrada.
      console.error(`Falha ao deletar o arquivo físico ${filePath}:`, fileError);
    }

    await prisma.fotosPropriedade.delete({
      where: { id },
    });

    // 2. CRIA A NOTIFICAÇÃO
    await createNotification({
        idPropriedade: foto.idPropriedade,
        idAutor: userId,
        mensagem: `O usuário '${userName}' removeu uma foto da propriedade '${foto.propriedade.nomePropriedade}'.`,
    });

    return res.status(200).json({ success: true, message: `Foto com ID ${id} deletada com sucesso.` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao deletar a foto.' });
  }
};