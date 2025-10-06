// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';

const deleteParamsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'ID inválido.' }),
});

/**
 * Realiza o soft-delete de um item de inventário e notifica
 * os membros sobre a remoção.
 */
export const deleteInventoryItemById = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    const { id } = deleteParamsSchema.parse(req.params);

    const itemExists = await prisma.itemInventario.findFirst({
      where: { id, excludedAt: null },
    });

    if (!itemExists) {
      return res.status(404).json({ success: false, message: 'Item de inventário não encontrado ou já foi deletado.' });
    }

    // O soft-delete é realizado marcando a data de exclusão.
    await prisma.itemInventario.update({
      where: { id },
      data: {
        excludedAt: new Date(),
      },
    });

    // 2. CRIA A NOTIFICAÇÃO APÓS A EXCLUSÃO
    await createNotification({
        idPropriedade: itemExists.idPropriedade,
        idAutor: userId,
        mensagem: `O usuário '${userName}' removeu o item '${itemExists.nome}' do inventário.`,
    });

    return res.status(200).json({ success: true, message: 'Item removido com sucesso.' });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao remover o item.' });
  }
};