// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Este controller realiza uma exclusão em massa, o que é perigoso.
// A lógica foi mantida, mas a validação de schema foi removida,
// já que ele não parece receber parâmetros.
// RECOMENDAÇÃO: Considere deletar este arquivo se ele não for realmente necessário.

export const removeUserFromPropertyPermission = async (req: Request, res: Response) => {
  try {
    const deletedVinculos = await prisma.usuariosPropriedades.updateMany({
      where: {
        excludedAt: null,
      },
      data: {
        excludedAt: new Date(),
      },
    });

    if (deletedVinculos.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum vínculo encontrado para deletar.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `${deletedVinculos.count} vínculo(s) deletado(s) com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao deletar vínculos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
    });
  }
};