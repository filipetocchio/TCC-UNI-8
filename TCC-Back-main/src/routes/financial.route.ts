// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import { protect } from '../middleware/authMiddleware';
import { upload, uploadInvoiceReceipt } from '../middleware/upload';
import { createExpense } from '../controllers/Financial/create.Expense.controller';
import { getExpensesByProperty } from '../controllers/Financial/get.Expenses.controller';
import { getExpenseById } from '../controllers/Financial/get.ExpenseById.controller';
import { updateExpense } from '../controllers/Financial/update.Expense.controller';
import { cancelExpense } from '../controllers/Financial/cancel.Expense.controller';
import { updatePaymentStatus } from '../controllers/Financial/update.PaymentStatus.controller';
import { generateFinancialReport } from '../controllers/Financial/report.Financial.controller';
import { getFinancialSummary } from '../controllers/Financial/summary.Financial.controller'; 
import { processInvoiceWithOCR } from '../controllers/Financial/ocr.ProcessInvoice.controller';

export const financial = express.Router();

/**
 * @route   POST /api/v1/financial/expense/manual
 * @desc    Cria uma nova despesa a partir de dados manuais.
 * @access  Privado
 */
financial.post('/expense/manual', protect, uploadInvoiceReceipt.array('comprovanteFile', 10), createExpense);

/**
 * @route   POST /api/v1/financial/ocr-process
 * @desc    Processa um arquivo PDF com o serviço de OCR e retorna os dados extraídos.
 * @access  Privado
 */
// ADICIONADO: Nova rota para o fluxo de OCR desacoplado.
financial.post('/ocr-process', protect, upload.single('invoiceFile'), processInvoiceWithOCR);

/**
 * @route   POST /api/v1/financial/expense/upload-ocr
 * @desc    (Obsoleto) Cria uma nova despesa a partir de um arquivo PDF.
 * @access  Privado
 */

/**
 * @route   GET /api/v1/financial/property/:propertyId/summary
 * @desc    Busca um resumo financeiro agregado para o dashboard.
 * @access  Privado
 */
financial.get('/property/:propertyId/summary', protect, getFinancialSummary);

/**
 * @route   GET /api/v1/financial/property/:propertyId
 * @desc    Lista todas as despesas de uma propriedade.
 * @access  Privado
 */
financial.get('/property/:propertyId', protect, getExpensesByProperty);

/**
 * @route   GET /api/v1/financial/expense/:expenseId
 * @desc    Busca os detalhes de uma despesa específica.
 * @access  Privado
 */
financial.get('/expense/:expenseId', protect, getExpenseById);

/**
 * @route   PUT /api/v1/financial/expense/:expenseId
 * @desc    Atualiza uma despesa existente.
 * @access  Privado
 */
financial.put('/expense/:expenseId', protect, uploadInvoiceReceipt.array('comprovanteFile', 10), updateExpense);

/**
 * @route   DELETE /api/v1/financial/expense/:expenseId
 * @desc    Cancela uma despesa (realiza um soft-delete).
 * @access  Privado
 */
financial.delete('/expense/:expenseId', protect, cancelExpense);

/**
 * @route   PUT /api/v1/financial/payment/:paymentId
 * @desc    Atualiza o status de um pagamento individual (pago/pendente).
 * @access  Privado
 */
financial.put('/payment/:paymentId', protect, updatePaymentStatus);

/**
 * @route   GET /api/v1/financial/property/:propertyId/report
 * @desc    Gera e retorna um relatório financeiro em PDF.
 * @access  Privado
 */
financial.get('/property/:propertyId/report', protect, generateFinancialReport);