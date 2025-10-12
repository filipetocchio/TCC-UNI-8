// Todos direitos autorais reservados pelo QOTA.

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { createNotification } from '../../utils/notification.service';
import { NotFoundError, PermissionError, AuthenticationError } from '../../utils/errors';

export const cancelExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError(); // Lança o erro de autenticação
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { expenseId } = req.params;

    const despesaExistente = await prisma.despesa.findUnique({
      where: { id: Number(expenseId) },
    });

    if (!despesaExistente) {
      throw new NotFoundError('Despesa não encontrada.'); // Lança o erro 404
    }
    if (despesaExistente.status === 'CANCELADO') {
        // Erros de negócio podem usar 'throw' também
      throw new Error('Esta despesa já foi cancelada anteriormente.');
    }
    
    const userPermission = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: userId,
        idPropriedade: despesaExistente.idPropriedade,
        permissao: 'proprietario_master',
      }
    });

    if (!userPermission) {
      // Lança o erro de permissão 403
      throw new PermissionError('Apenas o proprietário master pode cancelar uma despesa.');
    }

    const despesaCancelada = await prisma.despesa.update({
      where: { id: Number(expenseId) },
      data: { status: 'CANCELADO' },
    });

    await createNotification({
      idPropriedade: despesaCancelada.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' cancelou a despesa '${despesaCancelada.descricao}'.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Despesa cancelada com sucesso.',
      data: despesaCancelada,
    });

  } catch (error) {
    
    next(error);
  }
};