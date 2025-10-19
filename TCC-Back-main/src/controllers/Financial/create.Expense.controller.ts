// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Criação de Despesas
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint de criação de uma nova despesa,
 * seja ela uma despesa única ou o "template" para uma despesa recorrente.
 *
 * O processo é seguro e transacional:
 * 1.  Valida a autenticação, autorização (se o usuário é membro da propriedade)
 * e os dados da nova despesa.
 * 2.  Invoca o `expense.service` que, dentro de uma transação, cria o registro
 * da despesa e realiza o rateio automático dos pagamentos entre os cotistas.
 * 3.  Dispara uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { createExpenseWithPayments } from '../../services/expense.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'financial.log';

// Schema para validar os dados do corpo da requisição para criar uma despesa.
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

/**
 * Processa a criação de uma nova despesa.
 */
export const createExpense = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const validatedData = createExpenseSchema.parse(req.body);

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que o usuário é membro da propriedade antes de criar a despesa.
    const membership = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: userId,
        idPropriedade: validatedData.idPropriedade,
      },
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você não é membro desta propriedade.' });
    }
    
    // --- 3. Criação da Despesa e Rateios (Transacional) ---
    // A lógica complexa é encapsulada em uma transação dentro do `expense.service`.
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

    // --- 4. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: newExpense.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' registrou uma nova despesa: '${newExpense.descricao}'.`,
    }).catch(err => {
      logEvents(`Falha ao criar notificação para nova despesa: ${err.message}`, LOG_FILE);
    });

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: 'Despesa registrada e dividida entre os cotistas com sucesso.',
      data: newExpense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao criar despesa: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao criar a despesa.' });
  }
};