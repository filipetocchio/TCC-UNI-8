// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const paramsSchema = z.object({
  expenseId: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0),
});

export const getExpenseById = async (req: Request, res: Response) => {
  try {
    // Garante que o usuário está autenticado
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId } = req.user;

    const { expenseId } = paramsSchema.parse(req.params);

    const despesa = await prisma.despesa.findUnique({
      where: { id: expenseId },
    });

    if (!despesa) {
      return res.status(404).json({ success: false, message: 'Despesa não encontrada.' });
    }

    // Verifica se o usuário logado tem a permissão de 'proprietario_master' para esta propriedade
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idUsuario: userId,
            idPropriedade: despesa.idPropriedade,
            permissao: 'proprietario_master'
        }
    });
    const currentUserIsMaster = !!userPermission;

    const pagamentos = await prisma.pagamentoCotista.findMany({
        where: { idDespesa: expenseId },
        include: {
            cotista: {
                select: {
                    id: true,
                    nomeCompleto: true,
                    email: true,
                }
            }
        },
        orderBy: {
            cotista: {
                nomeCompleto: 'asc'
            }
        }
    });

    // Combina todos os dados em um único objeto de resposta
    const responseData = {
        ...despesa,
        pagamentos: pagamentos,
        currentUserIsMaster: currentUserIsMaster, // E envia a permissão para o frontend
    };

    return res.status(200).json({
      success: true,
      message: 'Detalhes da despesa recuperados com sucesso.',
      data: responseData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error("Erro ao buscar detalhes da despesa:", error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao buscar a despesa.' });
  }
};