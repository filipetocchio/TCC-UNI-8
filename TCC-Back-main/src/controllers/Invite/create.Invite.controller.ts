// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

const createInviteSchema = z.object({
  emailConvidado: z.string().email({ message: "O formato do e-mail do convidado é inválido." }),
  idPropriedade: z.number().int().positive({ message: "O ID da propriedade é obrigatório." }),
  permissao: z.string().min(1, { message: "A permissão é obrigatória." }),
});

export const createInvite = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { emailConvidado, idPropriedade, permissao } = createInviteSchema.parse(req.body);
    const { id: idConvidadoPor } = req.user;

    const masterPermission = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: idConvidadoPor,
        idPropriedade: idPropriedade,
        permissao: 'proprietario_master',
      },
    });

    if (!masterPermission) {
      return res.status(403).json({ success: false, message: "Acesso negado: Apenas proprietários master podem enviar convites." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: emailConvidado } });
    if (existingUser) {
        const isAlreadyMember = await prisma.usuariosPropriedades.findFirst({
            where: { idUsuario: existingUser.id, idPropriedade: idPropriedade }
        });
        if (isAlreadyMember) {
            return res.status(409).json({ success: false, message: "Este usuário já é membro da propriedade." });
        }
    }

    const token = randomBytes(32).toString('hex');
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 7);

    const convite = await prisma.convite.create({
      data: {
        token,
        emailConvidado,
        idPropriedade,
        idConvidadoPor,
        permissao,
        dataExpiracao,
      },
    });

    const linkConvite = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/convite/${convite.token}`;

    return res.status(201).json({
      success: true,
      message: `Convite criado com sucesso para ${emailConvidado}.`,
      data: { linkConvite },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    console.error("Erro ao criar convite:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao criar o convite." });
  }
};