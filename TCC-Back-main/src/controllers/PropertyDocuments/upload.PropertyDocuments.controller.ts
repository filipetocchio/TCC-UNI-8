// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';

const uploadSchema = z.object({
  idPropriedade: z.string().transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: 'O ID da propriedade é inválido.' }),
  tipoDocumento: z.string().min(1, { message: 'O tipo do documento é obrigatório.' }),
});

/**
 * Realiza o upload de um documento para uma propriedade e notifica
 * os membros sobre a nova adição.
 */
export const uploadPropertyDocument = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    
    const { idPropriedade, tipoDocumento } = uploadSchema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de documento foi enviado.' });
    }

    const propertyExists = await prisma.propriedades.findUnique({ where: { id: idPropriedade } });
    if (!propertyExists) {
      return res.status(404).json({ success: false, message: 'Propriedade não encontrada.' });
    }

    const { filename } = req.file;
    const url = `/uploads/documents/${filename}`;

    const newDocument = await prisma.documentosPropriedade.create({
      data: {
        idPropriedade,
        tipoDocumento,
        documento: url,
      },
    });

    // 2. CRIA A NOTIFICAÇÃO
    await createNotification({
      idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' adicionou um novo documento ('${tipoDocumento}') à propriedade '${propertyExists.nomePropriedade}'.`,
    });

    return res.status(201).json({
      success: true,
      message: 'Documento enviado com sucesso.',
      data: newDocument,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};