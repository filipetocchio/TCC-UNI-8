// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import puppeteer from 'puppeteer';

const reportSchema = z.object({
  propertyId: z.string().transform(val => parseInt(val, 10)),
  // Tornamos as datas obrigatórias, pois o relatório agora se baseia em um período de pagamento.
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

/**
 * Gera um relatório financeiro em PDF baseado nos pagamentos efetuados em um período.
 */
export const generateFinancialReport = async (req: Request, res: Response) => {
  try {
    const { propertyId, startDate, endDate } = reportSchema.parse({
      ...req.params,
      ...req.query
    });

    // 1. Busca a propriedade e executa as consultas financeiras em paralelo.
    const [property, expensesWithPayments, paymentSummary] = await Promise.all([
      prisma.propriedades.findUnique({ where: { id: propertyId } }),

      // Query 1: Busca as DESPESAS únicas que tiveram pagamentos no período.
      // Usamos 'some' para garantir que cada despesa apareça apenas uma vez na lista.
      prisma.despesa.findMany({
        where: {
          idPropriedade: propertyId,
          pagamentos: {
            some: {
              pago: true,
              dataPagamento: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              }
            }
          }
        },
        orderBy: { dataVencimento: 'desc' },
      }),

      // Query 2: Calcula o VALOR TOTAL PAGO no período, somando os pagamentos individuais.
      // Isso garante que o total no PDF seja o mesmo do painel "Visão Geral".
      prisma.pagamentoCotista.aggregate({
        _sum: {
          valorDevido: true,
        },
        where: {
          pago: true,
          dataPagamento: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
          despesa: {
            idPropriedade: propertyId,
          }
        }
      })
    ]);

    if (!property) {
      return res.status(404).json({ success: false, message: "Propriedade não encontrada." });
    }

    const totalPaidInPeriod = paymentSummary._sum.valorDevido || 0;

    // 2. Monta o conteúdo HTML do relatório com os dados corretos.
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
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
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

    // 3. Usa o Puppeteer para gerar o PDF a partir do HTML.
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // 4. Envia o PDF como resposta.
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-pagamentos-${propertyId}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error("Erro ao gerar relatório:", error); 
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao gerar o relatório.' });
  }
};