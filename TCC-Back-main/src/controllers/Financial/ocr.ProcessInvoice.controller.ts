// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller Gateway para Processamento de Faturas via OCR
 *
 * Descrição:
 * Este arquivo atua como um gateway ou "proxy" para um microserviço externo de OCR
 * (Reconhecimento Óptico de Caracteres), responsável por extrair dados de faturas.
 *
 * O processo é responsável por:
 * 1.  Receber um arquivo de fatura de um usuário autenticado.
 * 2.  Empacotar o arquivo em um formato `multipart/form-data`.
 * 3.  Enviar esses dados para o serviço de OCR.
 * 4.  Retransmitir a resposta (os dados extraídos) do serviço de OCR de volta
 * para o cliente, para que ele possa revisar e confirmar a criação da despesa.
 */
import { Request, Response } from 'express';
import axios, { isAxiosError } from 'axios';
import FormData from 'form-data';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'ocr.log';

// URL do serviço de OCR, configurável via variáveis de ambiente.
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000/processar-documento';

/**
 * Processa uma fatura, atuando como proxy para o serviço de OCR.
 */
export const processInvoiceWithOCR = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    // --- 2. Montagem da Requisição para o Serviço de OCR ---
    // Prepara o formulário para enviar o arquivo ao serviço de OCR.
    const form = new FormData();
    form.append('arquivo', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('tipo_analise', 'extracao_conta');

    // --- 3. Comunicação com o Serviço de OCR ---
    // Envia a requisição para o serviço externo e aguarda a resposta.
    const ocrResponse = await axios.post(OCR_SERVICE_URL, form, {
      headers: { ...form.getHeaders() },
    });

    // --- 4. Retransmissão da Resposta de Sucesso ---
    // Retorna os dados extraídos pela IA para o frontend.
    return res.status(200).json({
      success: true,
      message: 'Dados extraídos com sucesso.',
      data: ocrResponse.data.dados,
    });

  } catch (error) {
    // --- 5. Tratamento Centralizado de Erros ---
    // Trata especificamente erros de comunicação com o serviço de OCR.
    if (isAxiosError(error)) {
      const errorMessage = error.response?.data?.detail || 'Não foi possível processar o documento com o serviço de IA.';
      const statusCode = error.response?.status || 502; // 502 Bad Gateway se o serviço estiver offline
      logEvents(`ERRO no serviço de OCR: Status ${statusCode} - ${errorMessage}`, LOG_FILE);
      return res.status(statusCode).json({ success: false, message: errorMessage });
    }
    
    // Fallback para qualquer outro erro inesperado.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao processar fatura com OCR: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({ 
      success: false, 
      message: 'Ocorreu um erro inesperado no servidor ao processar o documento.' 
    });
  }
};