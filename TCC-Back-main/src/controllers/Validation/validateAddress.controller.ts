// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller Gateway para Validação de Endereço via OCR
 *
 * Descrição:
 * Este arquivo atua como um gateway ou "proxy" para um microserviço externo de OCR
 * (Reconhecimento Óptico de Caracteres), responsável por validar comprovantes de endereço.
 *
 * O processo é responsável por:
 * 1.  Receber um arquivo de documento (ex: conta de luz) e os dados de endereço do cliente.
 * 2.  Validar os dados de entrada.
 * 3.  Empacotar o arquivo e os dados em um formato `multipart/form-data`.
 * 4.  Enviar esses dados para o serviço de OCR.
 * 5.  Retransmitir a resposta (sucesso ou falha) do serviço de OCR de volta para o cliente.
 */
import { Request, Response } from 'express';
import axios, { isAxiosError } from 'axios';
import FormData from 'form-data';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// --- Constantes e Schemas de Validação ---

// URL do serviço de OCR, configurável via variáveis de ambiente.
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8000/processar-documento';

// Schema para validar os dados do endereço e CEP enviados no corpo da requisição.
const validationSchema = z.object({
  address: z.string().min(10, { message: 'O endereço deve ter no mínimo 10 caracteres.' }),
  cep: z.string().min(8, { message: 'O CEP é obrigatório para a validação.' }),
});

/**
 * Processa a validação de um documento de endereço, atuando como proxy para o serviço de OCR.
 */
export const validateAddressDocument = async (req: Request, res: Response) => {
  try {


    // --- 1. Validação da Requisição (Arquivo e Dados) ---
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de documento foi enviado.' });
    }
    const { address, cep } = validationSchema.parse(req.body);

    // --- 2. Montagem da Requisição para o Serviço de OCR ---
    // Cria um payload 'multipart/form-data' para enviar o arquivo e os dados de texto.
    const form = new FormData();
    form.append('arquivo', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('endereco_formulario', address);
    form.append('cep_formulario', cep);

    // --- 3. Comunicação com o Serviço de OCR ---
    // Envia a requisição para o serviço externo e aguarda a resposta.
    const ocrResponse = await axios.post(OCR_SERVICE_URL, form, {
      headers: { ...form.getHeaders() },
    });

    // --- 4. Retransmissão da Resposta de Sucesso ---
    // Retorna a mensagem de sucesso do serviço de OCR diretamente para o cliente.
    return res.status(200).json({
      success: true,
      message: ocrResponse.data.mensagem,
    });

  } catch (error) {
    // --- 5. Tratamento Centralizado de Erros ---
    const logMessage = `Falha no fluxo de validação de endereço: ${error instanceof Error ? error.message : 'Erro desconhecido'}\n${error instanceof Error ? error.stack : ''}`;
    logEvents(logMessage, 'errLog.txt');

    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    // Trata especificamente erros de comunicação com o serviço de OCR.
    if (isAxiosError(error)) {
      // Retransmite o status e a mensagem de erro do serviço de OCR, se disponíveis.
      // Se o serviço estiver totalmente indisponível, retorna 502 (Bad Gateway).
      return res.status(error.response?.status || 502).json({ 
        success: false, 
        message: error.response?.data?.detail || 'O serviço de validação de documentos está indisponível.' 
      });
    }

    // Fallback para qualquer outro erro inesperado.
    return res.status(500).json({ 
      success: false, 
      message: 'Ocorreu um erro inesperado no servidor ao processar a validação do documento.' 
    });
  }
};