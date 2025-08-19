import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deleteUser = async (req: Request, res: Response) => {
  try {

    const activeUsers = await prisma.user.count({
      where: { excludedAt: null },
    });

    if (activeUsers === 0) {
      return res.status(200).json({
        success: true,
        message: 'Nenhum usuário ativo encontrado para deletar.',
      });
    }

    const result = await prisma.user.updateMany({
      where: { excludedAt: null },
      data: {
        excludedAt: new Date(),
        updatedAt: new Date(), 
      },
    });

    return res.status(200).json({
      success: true,
      message: `${result.count} usuário(s) deletado(s) com sucesso (soft delete).`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
        error: 'Erro de validação nos dados fornecidos.',
      });
    }

    console.error('Erro ao deletar todos os usuários:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
      error: 'Ocorreu um erro ao processar a solicitação.',
    });
  }
};

export { deleteUser };