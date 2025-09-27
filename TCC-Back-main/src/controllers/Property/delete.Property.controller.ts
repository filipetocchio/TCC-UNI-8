// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';

const deleteProperty = async (req: Request, res: Response) => {
  try {
    const { nomePropriedade } = req.params;

    if (!nomePropriedade || nomePropriedade.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'O nome da propriedade é obrigatório.',
        error: 'O nome da propriedade não foi fornecido na URL.',
      });
    }

    const property = await prisma.propriedades.findFirst({
      where: { nomePropriedade: nomePropriedade, excludedAt: null },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Propriedade não encontrada ou já deletada.',
        error: 'Propriedade não encontrada ou já deletada.',
      });
    }

    await prisma.propriedades.update({
      where: { id: property.id },
      data: {
        excludedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Propriedade deletada com sucesso (soft delete).',
    });
  } catch (error) {
    console.error(`Erro ao deletar propriedade por nome ${req.params.nomePropriedade || 'desconhecido'}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
      error: 'Ocorreu um erro ao processar a solicitação.',
    });
  }
};

export { deleteProperty };