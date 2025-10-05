// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validação do ID da propriedade vindo da rota.
const paramsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Lista todos os convites pendentes e não expirados para uma propriedade específica.
 */
export const getPendingByProperty = async (req: Request, res: Response) => {
  try {
    const { propertyId } = paramsSchema.parse(req.params);

    const pendingInvites = await prisma.convite.findMany({
      where: {
        idPropriedade: propertyId,
        status: 'PENDENTE',
        dataExpiracao: { gte: new Date() },
      },
      select: {
        id: true,
        emailConvidado: true,
        permissao: true,
        porcentagemCota: true, 
        dataExpiracao: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Convites pendentes recuperados com sucesso.',
      data: pendingInvites,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao buscar convites." });
  }
};