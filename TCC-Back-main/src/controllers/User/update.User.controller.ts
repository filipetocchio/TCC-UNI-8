// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  nomeCompleto: z.string().min(1).max(100).optional(),
  telefone: z.string().optional().refine(val => !val || /^\d{10,11}$/.test(val)),
});

export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    const { email, password, nomeCompleto, telefone } = updateUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Usuário não encontrado." });
    }
    if (existing.excludedAt) {
      return res.status(400).json({ success: false, message: "Usuário já excluído." });
    }

    if (email) {
      const dup = await prisma.user.findFirst({
        where: { email, id: { not: userId } }
      });
      if (dup) {
        return res.status(409).json({ success: false, message: "Email já em uso." });
      }
    }

    const dataToUpdate: any = {};
    if (email) dataToUpdate.email = email;
    if (nomeCompleto) dataToUpdate.nomeCompleto = nomeCompleto;
    if (telefone !== undefined) dataToUpdate.telefone = telefone;
    if (password) dataToUpdate.password = await bcrypt.hash(password, 10);

    if (req.file) {
      const filename = req.file.filename;
      const url = `/uploads/profile/${filename}`;

      await prisma.userPhoto.upsert({
        where: { userId },
        create: { userId, filename, url },
        update: { filename, url, uploadedAt: new Date() },
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      include: {
        userPhoto: true, 
      },
    });

  
    // com a foto de perfil aninhada dentro de 'userPhoto'.
    const responseData = {
        id: updated.id,
        email: updated.email,
        nomeCompleto: updated.nomeCompleto,
        telefone: updated.telefone,
        cpf: updated.cpf,
        // Mantém a estrutura aninhada, que é o que a Sidebar e o resto da aplicação esperam.
        userPhoto: updated.userPhoto 
          ? { url: `${req.protocol}://${req.get('host')}${updated.userPhoto.url}` } 
          : null,
    };

    return res.status(200).json({
      success: true,
      message: "Usuário atualizado com sucesso.",
      data: responseData,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor.",
    });
  }
};