// Todos direitos autorais reservados pelo QOTA.

import { Request, Response } from 'express';
import axios, { isAxiosError } from 'axios';
import FormData from 'form-data';
import { z } from 'zod';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000/processar-documento';

// Tornando o CEP obrigatório para a validação
const validationSchema = z.object({
  address: z.string().min(10, { message: 'O endereço deve ter no mínimo 10 caracteres.' }),
  cep: z.string().min(8, { message: 'O CEP é obrigatório para a validação.' }),
});

export const validateAddressDocument = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de documento foi enviado.' });
    }
    const { address, cep } = validationSchema.parse(req.body);

    const form = new FormData();
    form.append('arquivo', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('endereco_formulario', address);
    form.append('cep_formulario', cep);

    const ocrResponse = await axios.post(OCR_SERVICE_URL, form, {
      headers: { ...form.getHeaders() },
    });

    return res.status(200).json({
      success: true,
      message: ocrResponse.data.mensagem,
    });

  } catch (error) {
    console.error('Falha no fluxo de validação de endereço:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    if (isAxiosError(error)) {
      return res.status(error.response?.status || 502).json({ 
        success: false, 
        message: error.response?.data?.detail || 'O serviço de validação de documentos está indisponível.' 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao processar a validação do documento.' 
    });
  }
};