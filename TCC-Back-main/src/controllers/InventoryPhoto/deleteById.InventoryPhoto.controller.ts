// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';

const paramsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'O ID da foto é inválido.' }),
});

/**
 * Realiza o soft-delete de uma foto de inventário e notifica os membros.
 * A exclusão física do arquivo do disco não é realizada para permitir
 * uma possível recuperação futura (undelete).
 */
export const deleteInventoryPhotoById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    
    const { id } = paramsSchema.parse(req.params);

    const photoExists = await prisma.fotoInventario.findFirst({
      where: { id, excludedAt: null },
      include: {
        itemInventario: {
          include: {
            propriedade: {
              select: { nomePropriedade: true }
            }
          }
        }
      }
    });

    if (!photoExists) {
      return res.status(404).json({ success: false, message: 'Foto não encontrada ou já foi deletada.' });
    }

    await prisma.fotoInventario.update({
      where: { id },
      data: { excludedAt: new Date() },
    });

    // Cria a notificação para registrar a atividade.
    await createNotification({
      idPropriedade: photoExists.itemInventario.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' removeu uma foto do item '${photoExists.itemInventario.nome}' na propriedade '${photoExists.itemInventario.propriedade.nomePropriedade}'.`,
    });

    return res.status(200).json({ success: true, message: 'Foto deletada com sucesso.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao deletar a foto.' });
  }
};