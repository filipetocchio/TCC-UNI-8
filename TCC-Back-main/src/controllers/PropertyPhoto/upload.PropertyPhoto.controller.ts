// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';

const uploadPhotoSchema = z.object({
  idPropriedade: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Salva as informações de uma foto de propriedade no banco de dados
 * após o middleware 'uploadPropertyPhoto' ter processado o arquivo.
 */
export const UploadPropertyPhoto = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo de foto foi enviado.' });
    }

    const { idPropriedade } = uploadPhotoSchema.parse(req.body);

    const propriedade = await prisma.propriedades.findUnique({
      where: { id: idPropriedade }
    });
    if (!propriedade) {
      return res.status(404).json({ success: false, message: `Propriedade com ID ${idPropriedade} não encontrada.` });
    }
    
    // O caminho do arquivo agora é gerado pelo middleware e já contém a pasta correta.
    const url = `/uploads/property/${req.file.filename}`;

    const foto = await prisma.fotosPropriedade.create({
      data: {
        idPropriedade,
        documento: url,
      },
    });

    await createNotification({
      idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' adicionou uma nova foto à propriedade '${propriedade.nomePropriedade}'.`,
    });

    return res.status(201).json({ success: true, message: "Foto enviada com sucesso.", data: foto });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno ao salvar a foto.' });
  }
};