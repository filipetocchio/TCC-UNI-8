// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deleteParamsSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'O ID do vínculo é inválido.' }),
});

/**
 * Realiza o soft-delete de um vínculo específico entre usuário e propriedade.
 */
export const removeUserFromPropertyPermissionById = async (req: Request, res: Response) => {
  try {
    const { id } = deleteParamsSchema.parse(req.params);

    const vinculo = await prisma.usuariosPropriedades.findUnique({
      where: { id },
    });

    if (!vinculo) {
      return res.status(404).json({ success: false, message: 'Vínculo não encontrado.' });
    }

    if (vinculo.excludedAt) {
      return res.status(400).json({ success: false, message: 'Este vínculo já foi removido anteriormente.' });
    }

    await prisma.usuariosPropriedades.update({
      where: { id },
      data: { excludedAt: new Date() },
    });

    return res.status(200).json({ success: true, message: 'Vínculo removido com sucesso.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao remover o vínculo.' });
  }
};