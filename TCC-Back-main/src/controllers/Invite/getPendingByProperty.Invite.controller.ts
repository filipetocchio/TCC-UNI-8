/**
 * @file getPendingByProperty.Invite.controller.ts
 * @description Controller para listar todos os convites com status PENDENTE para uma propriedade específica.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const paramsSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
});

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
    // Tratamento de erros...
    console.error("Erro ao buscar convites pendentes:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};