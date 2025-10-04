// Todos direitos autorais reservados pelo QOTA.

import { Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { z } from 'zod';
import { prisma } from '../../utils/prisma';

// URL do nosso microsserviço de OCR criado em Python
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000/processar-documento';

// Schema para validar os dados que vêm junto com o arquivo
const uploadSchema = z.object({
  idPropriedade: z.string().transform(val => parseInt(val, 10)),
  descricao: z.string().min(1, { message: 'A descrição da despesa é obrigatória.' }),
});

export const uploadInvoice = async (req: Request, res: Response) => {
  try {
    // 1. Validar inputs básicos
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de conta foi enviado.' });
    }
    const { idPropriedade, descricao } = uploadSchema.parse(req.body);

    // 2. Montar o payload para o serviço de OCR
    const form = new FormData();
    form.append('arquivo', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('tipo_analise', 'extracao_conta');

    // 3. Chamar o microsserviço Python
    const ocrResponse = await axios.post(OCR_SERVICE_URL, form, {
      headers: { ...form.getHeaders() },
    });

    // 4. Extrair e validar os dados retornados pelo OCR
    const { valor_total, data_vencimento } = ocrResponse.data.dados;
    if (!valor_total || !data_vencimento) {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível extrair o valor e a data de vencimento do documento. Tente um arquivo com melhor qualidade.',
      });
    }

    // 5. Preparar e salvar os dados no banco
    const valorNumerico = parseFloat(valor_total.replace('.', '').replace(',', '.'));
    const [dia, mes, ano] = data_vencimento.split('/');
    const dataVencimentoISO = new Date(`${ano}-${mes}-${dia}`);

    const novaDespesa = await prisma.despesa.create({
      data: {
        idPropriedade,
        descricao,
        valor: valorNumerico,
        dataVencimento: dataVencimentoISO,
        empresa: ocrResponse.data.dados.empresa,
        categoria: ocrResponse.data.dados.categoria,
        // Futuramente, aqui salvaremos o arquivo em um storage e guardaremos a URL.
        // Por enquanto, salvamos o nome do arquivo como placeholder.
        urlComprovante: `/uploads/invoices/${req.file.filename}`, // Placeholder
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Despesa registrada com sucesso a partir do documento!',
      data: novaDespesa,
    });

  } catch (error) {
    console.error('Erro no processamento da conta:', error);
    // Delega o erro do Axios para o front-end, se aplicável
    if (axios.isAxiosError(error)) {
        return res.status(error.response?.status || 500).json({ 
          success: false, 
          message: error.response?.data?.detail || 'O serviço de OCR retornou um erro.' 
        });
      }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};