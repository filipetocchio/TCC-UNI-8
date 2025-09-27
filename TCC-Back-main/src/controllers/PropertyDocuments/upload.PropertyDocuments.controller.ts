/**
 * @file upload.PropertyDocuments.controller.ts
 * @description Controller para o upload e persistência de documentos de propriedades.
 */

// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * @name uploadSchema
 * @description Valida os campos do corpo da requisição multipart/form-data.
 * Garante que a API receba todos os dados necessários para associar o documento a uma propriedade.
 */
const uploadSchema = z.object({
  idPropriedade: z.string().transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'O ID da propriedade é inválido.' }),
  tipoDocumento: z.string().min(1, { message: 'O tipo do documento é obrigatório.' }),
});

export const uploadPropertyDocument = async (req: Request, res: Response) => {
  try {
    // 1. Valida os campos de texto do formulário (req.body)
    const { idPropriedade, tipoDocumento } = uploadSchema.parse(req.body);

    // 2. Valida a existência do arquivo (req.file)
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de documento foi enviado.' });
    }

    // 3. Verifica se a propriedade associada existe no banco de dados
    const propertyExists = await prisma.propriedades.findUnique({ where: { id: idPropriedade } });
    if (!propertyExists) {
      return res.status(404).json({ success: false, message: 'Propriedade não encontrada.' });
    }

    const { filename } = req.file;
    const url = `/uploads/documents/${filename}`; // Assume que os documentos são salvos em 'uploads/documents'

    // 4. Persiste o registro do documento no banco de dados
    const newDocument = await prisma.documentosPropriedade.create({
      data: {
        idPropriedade,
        tipoDocumento,
        documento: url, // Salva a URL de acesso ao arquivo
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Documento enviado com sucesso.',
      data: newDocument,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    console.error("Erro no upload de documento:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};

