// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';

/**
 * Realiza o soft-delete de todos os vínculos ativos do sistema.
 * ATENÇÃO: Esta é uma operação administrativa de alto impacto.
 */
export const removeUserFromPropertyPermission = async (req: Request, res: Response) => {
  try {
    const { count } = await prisma.usuariosPropriedades.updateMany({
      where: {
        excludedAt: null,
      },
      data: {
        excludedAt: new Date(),
      },
    });

    if (count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum vínculo ativo encontrado para ser removido.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `${count} vínculo(s) removido(s) com sucesso.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao remover os vínculos.',
    });
  }
};