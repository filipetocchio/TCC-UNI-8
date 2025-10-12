// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { createExpenseWithPayments } from '../../services/expense.service';

const createExpenseSchema = z.object({
  idPropriedade: z.coerce.number().int().positive(),
  descricao: z.string().min(1),
  valor: z.coerce.number().positive(),
  dataVencimento: z.string().datetime(),
  categoria: z.string().min(1),
  observacao: z.string().optional(),
  recorrente: z.string().transform(val => val === 'true'),
  frequencia: z.string().optional(),
  diaRecorrencia: z.coerce.number().int().optional(),
});

export const createExpense = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const validatedData = createExpenseSchema.parse(req.body);

    // --- BLOCO DE VERIFICAÇÃO DE SEGURANÇA ---
    // Garante que o usuário é membro da propriedade antes de criar a despesa.
    const membership = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: userId,
        idPropriedade: validatedData.idPropriedade,
      },
    });

    // Se o vínculo entre usuário e propriedade não for encontrado, retorna um erro de acesso negado.
    if (!membership) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você não é membro desta propriedade.' });
    }
    // --- FIM DO BLOCO ---

    const newExpense = await prisma.$transaction(async (tx) => {
      const expenseData = {
        ...validatedData,
        observacao: validatedData.observacao ?? null,
        frequencia: validatedData.frequencia ?? null,
        diaRecorrencia: validatedData.diaRecorrencia ?? null,
        criadoPorId: userId,
        dataVencimento: new Date(validatedData.dataVencimento),
        urlComprovante: req.files && Array.isArray(req.files) && req.files.length > 0
          ? (req.files as Express.Multer.File[]).map(file => `/uploads/invoices/${file.filename}`).join(',')
          : null,
        jurosAtraso: null,
        multaAtraso: null,
        recorrenciaPaiId: null,
      };
      
      return await createExpenseWithPayments(expenseData, tx);
    });

    await createNotification({
      idPropriedade: newExpense.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' registrou uma nova despesa: '${newExpense.descricao}'.`,
    });

    return res.status(201).json({
      success: true,
      message: 'Despesa registrada e dividida entre os cotistas com sucesso.',
      data: newExpense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    return res.status(500).json({ success: false, message: errorMessage });
  }
};