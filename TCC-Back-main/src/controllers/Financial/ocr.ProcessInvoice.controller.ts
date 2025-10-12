// Todos direitos autorais reservados pelo QOTA.

import { Request, Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000/processar-documento';

/**
 * Recebe um arquivo do frontend, encaminha para o serviço de OCR em Python,
 * e retorna os dados extraídos para o frontend para confirmação do usuário.
 */
export const processInvoiceWithOCR = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    // 1. Prepara o formulário para enviar ao serviço Python.
    const form = new FormData();
    form.append('arquivo', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('tipo_analise', 'extracao_conta');

    // 2. Envia a requisição para o serviço de OCR.
    const ocrResponse = await axios.post(OCR_SERVICE_URL, form, {
      headers: { ...form.getHeaders() },
    });

    // 3. Retorna os dados extraídos pela IA para o frontend.
    return res.status(200).json({
      success: true,
      message: 'Dados extraídos com sucesso.',
      data: ocrResponse.data.dados,
    });

  } catch (error: any) {
    // Se o serviço de OCR retornar um erro (ex: 400), ele será capturado aqui.
    console.error("Erro ao processar com OCR:", error.response?.data || error.message);
    const errorMessage = error.response?.data?.detail || "Não foi possível processar o documento com a IA.";
    const statusCode = error.response?.status || 500;
    return res.status(statusCode).json({ success: false, message: errorMessage });
  }
};