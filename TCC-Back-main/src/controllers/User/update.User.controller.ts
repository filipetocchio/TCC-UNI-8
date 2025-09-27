// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";

// Schema de validação (sem foto, pois foto é `req.file`)
const updateUserSchema = z.object({
  email:        z.string().email().optional(),
  password:     z.string().min(6).optional(),
  nomeCompleto: z.string().min(1).max(100).optional(),
  telefone:     z.string().optional().refine(val => !val || /^\d{10,11}$/.test(val)),
});

const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = Number.parseInt(req.params.id, 10);
    const { email, password, nomeCompleto, telefone } = updateUserSchema.parse(req.body);

    // Verifica existência do usuário
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Usuário não encontrado." });
    }
    if (existing.excludedAt) {
      return res.status(400).json({ success: false, message: "Usuário já excluído." });
    }

    // Evita e-mail duplicado
    if (email) {
      const dup = await prisma.user.findFirst({
        where: { email, id: { not: userId } }
      });
      if (dup) {
        return res.status(409).json({ success: false, message: "Email já em uso." });
      }
    }

    // Monta dados de atualização
    const dataToUpdate: any = {};
    if (email)        dataToUpdate.email        = email;
    if (nomeCompleto) dataToUpdate.nomeCompleto = nomeCompleto;
    if (telefone !== undefined) dataToUpdate.telefone = telefone;
    if (password)     dataToUpdate.password     = await bcrypt.hash(password, 10);

    // Lida com upload de fotoPerfil (via multer)
    if (req.file) {
      const filename = req.file.filename;
      const url = `/uploads/profile/${filename}`;

      // Upsert na tabela UserPhoto
      await prisma.userPhoto.upsert({
        where:   { userId },
        create:  { userId, filename, url },
        update:  { filename, url, uploadedAt: new Date() },
      });
    }

    // Atualiza o usuário e já inclui a relação userPhoto
    const updated = await prisma.user.update({
      where: { id: userId },
      data:  dataToUpdate,
      include: {
        userPhoto: true,  // traz { id, userId, filename, url, uploadedAt }
      },
    });

    // Retorna o payload unificado
    return res.status(200).json({
      success: true,
      message: "Usuário atualizado com sucesso.",
      data: {
        id:            updated.id,
        email:         updated.email,
        nomeCompleto:  updated.nomeCompleto,
        telefone:      updated.telefone,
        cpf:           updated.cpf,
        urlFotoPerfil: updated.userPhoto?.url || null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor.",
    });
  }
};

export { updateUser };
