// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Geração de Relatório Financeiro em PDF
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que gera um relatório financeiro
 * em PDF para uma propriedade específica, detalhando as despesas pagas dentro de
 * um período de datas fornecido.
 *
 * O processo é seguro, mas intensivo em recursos:
 * 1.  Valida a autenticação e autorização do usuário (se é membro da propriedade).
 * 2.  Executa consultas paralelas para buscar os dados financeiros relevantes.
 * 3.  Monta um documento HTML com os dados.
 * 4.  Utiliza o Puppeteer (um navegador headless) para renderizar o HTML como um PDF.
 * 5.  Envia o buffer do PDF gerado como resposta para download.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import puppeteer from 'puppeteer';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'financial.log';

// Schema para validar os parâmetros da rota e da query.
const reportSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

/**
 * Gera um relatório financeiro em PDF baseado nos pagamentos efetuados em um período.
 */
export const generateFinancialReport = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId } = req.user;
    
    const { propertyId, startDate, endDate } = reportSchema.parse({
      ...req.params,
      ...req.query
    });

    // --- 2. Verificação de Autorização (Segurança) ---
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: { idPropriedade: propertyId, idUsuario: userId }
    });

    if (!userPermission) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Você não é membro desta propriedade.' });
    }

    // --- 3. Busca de Dados Financeiros (Desempenho) ---
    // As consultas são executadas em paralelo para otimizar o tempo de resposta.
    const [property, expensesWithPayments, paymentSummary] = await Promise.all([
      prisma.propriedades.findUnique({ where: { id: propertyId } }),
      prisma.despesa.findMany({
        where: { idPropriedade: propertyId, pagamentos: { some: { pago: true, dataPagamento: { gte: new Date(startDate), lte: new Date(endDate) } } } },
        orderBy: { dataVencimento: 'desc' },
      }),
      prisma.pagamentoCotista.aggregate({
        _sum: { valorDevido: true },
        where: { pago: true, dataPagamento: { gte: new Date(startDate), lte: new Date(endDate) }, despesa: { idPropriedade: propertyId } }
      })
    ]);

    if (!property) {
      return res.status(404).json({ success: false, message: "Propriedade não encontrada." });
    }

const totalPaidInPeriod = paymentSummary._sum.valorDevido || 0;

    // --- 4. Geração do Conteúdo HTML ---
    // Monta um documento HTML completo e bem estilizado para ser renderizado em PDF.
    const periodoRelatorio = `de ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Relatório de Pagamentos - ${property.nomePropriedade}</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #333; }
              h1 { color: #111; border-bottom: 2px solid #FBBF24; padding-bottom: 10px; }
              h2 { color: #444; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; font-size: 14px; }
              th { background-color: #f9f9f9; font-weight: 600; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .total { font-weight: bold; font-size: 1.1em; }
              .footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #777; }
          </style>
      </head>
      <body>
          <h1>Relatório de Pagamentos</h1>
          <h2>Propriedade: ${property.nomePropriedade}</h2>
          <p>Período de Pagamento: ${periodoRelatorio}</p>

          <table>
              <thead>
                  <tr>
                      <th>Descrição da Despesa</th>
                      <th>Categoria</th>
                      <th>Data de Vencimento</th>
                      <th>Status</th>
                      <th>Valor Total da Despesa</th>
                  </tr>
              </thead>
              <tbody>
                  ${expensesWithPayments.map(exp => `
                      <tr>
                          <td>${exp.descricao}</td>
                          <td>${exp.categoria}</td>
                          <td>${new Date(exp.dataVencimento).toLocaleDateString('pt-BR')}</td>
                          <td>${exp.status}</td>
                          <td>${Number(exp.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </tr>
                  `).join('')}
                  <tr class="total">
                      <td colspan="4" style="text-align: right;">Total Pago no Período:</td>
                      <td>${Number(totalPaidInPeriod).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
              </tbody>
          </table>

          <div class="footer">
              Relatório gerado pelo Sistema Qota em ${new Date().toLocaleString('pt-BR')}
          </div>
      </body>
      </html>
    `;

    // --- 5. Renderização do PDF com Puppeteer (Escalabilidade) ---

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // --- 6. Envio da Resposta ---
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-pagamentos-${propertyId}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    logEvents(`ERRO ao gerar relatório financeiro: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({ success: false, message: 'Ocorreu um erro inesperado no servidor ao gerar o relatório.' });
  }
};