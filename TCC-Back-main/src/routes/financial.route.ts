// Todos direitos autorais reservados pelo QOTA.

/**
 * Definição das Rotas do Módulo Financeiro
 *
 * Descrição:
 * Este arquivo centraliza a definição de todas as rotas da API relacionadas ao
 * módulo financeiro. Isso inclui o CRUD completo de despesas, atualização de
 * status de pagamentos, geração de relatórios, resumos financeiros e o
 * processamento de faturas via OCR.
 *
 * Todas as rotas são protegidas e a autorização granular (verificar se o usuário
 * pertence à propriedade) é tratada dentro de cada controlador.
 */
import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { upload, uploadInvoiceReceipt } from '../middleware/upload';

// Importação dos controladores do módulo financeiro
import { createExpense } from '../controllers/Financial/create.Expense.controller';
import { getExpensesByProperty } from '../controllers/Financial/get.Expenses.controller';
import { getExpenseById } from '../controllers/Financial/get.ExpenseById.controller';
import { updateExpense } from '../controllers/Financial/update.Expense.controller';
import { cancelExpense } from '../controllers/Financial/cancel.Expense.controller';
import { updatePaymentStatus } from '../controllers/Financial/update.PaymentStatus.controller';
import { generateFinancialReport } from '../controllers/Financial/report.Financial.controller';
import { getFinancialSummary } from '../controllers/Financial/summary.Financial.controller';
import { processInvoiceWithOCR } from '../controllers/Financial/ocr.ProcessInvoice.controller';

// Criação do roteador para o escopo financeiro.
export const financial = express.Router();


// --- Rotas de Processamento de Documentos (OCR) ---

// Rota para processar um arquivo de fatura com o serviço de OCR.
// Acesso: Privado.
financial.post('/ocr-process', protect, upload.single('invoiceFile'), processInvoiceWithOCR);


// --- Rotas de Despesas (Expenses) ---

// Rota para criar uma nova despesa a partir de dados manuais.
// Acesso: Privado.
financial.post('/expense/manual', protect, uploadInvoiceReceipt.array('comprovanteFile', 10), createExpense);

// Rota para buscar os detalhes de uma despesa específica.
// Acesso: Privado.
financial.get('/expense/:expenseId', protect, getExpenseById);

// Rota para atualizar uma despesa existente.
// Acesso: Privado.
financial.put('/expense/:expenseId', protect, uploadInvoiceReceipt.array('comprovanteFile', 10), updateExpense);

// Rota para cancelar uma despesa (realiza um soft-delete).
// Acesso: Privado.
financial.delete('/expense/:expenseId', protect, cancelExpense);


// --- Rotas de Pagamentos (Payments) ---

// Rota para atualizar o status de um pagamento individual (pago/pendente).
// Acesso: Privado.
financial.put('/payment/:paymentId', protect, updatePaymentStatus);


// --- Rotas Agregadas por Propriedade ---

// Rota para buscar um resumo financeiro para o dashboard de uma propriedade.
// Acesso: Privado.
financial.get('/property/:propertyId/summary', protect, getFinancialSummary);

// Rota para gerar e retornar um relatório financeiro em PDF de uma propriedade.
// Acesso: Privado.
financial.get('/property/:propertyId/report', protect, generateFinancialReport);

// Rota para listar todas as despesas de uma propriedade (deve ser a última rota genérica).
// Acesso: Privado.
financial.get('/property/:propertyId', protect, getExpensesByProperty);