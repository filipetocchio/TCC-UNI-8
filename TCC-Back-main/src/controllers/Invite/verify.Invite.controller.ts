// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema para validar se o token foi fornecido e não está vazio.
const verifyInviteSchema = z.object({
  token: z.string().min(1, { message: "O token do convite é obrigatório." }),
});

/**
 * Verifica a validade de um token de convite e retorna os detalhes
 * para que o frontend possa apresentar a tela de aceitação ao usuário.
 */
export const verifyInvite = async (req: Request, res: Response) => {
  try {
    const { token } = verifyInviteSchema.parse(req.params);

    const convite = await prisma.convite.findUnique({
      where: { token },
      select: {
        status: true,
        dataExpiracao: true,
        emailConvidado: true,
        usuarioJaExiste: true,
        propriedade: { select: { nomePropriedade: true } },
        convidadoPor: { select: { nomeCompleto: true } },
      },
    });

    // Validações de segurança e de negócio
    if (!convite || convite.status !== 'PENDENTE') {
      return res.status(404).json({ success: false, message: "Convite inválido ou já utilizado." });
    }
    if (new Date() > convite.dataExpiracao) {
      // Invalida o convite expirado no banco para evitar reutilização
      await prisma.convite.update({ where: { token }, data: { status: 'EXPIRADO' } });
      return res.status(410).json({ success: false, message: "Este convite expirou." });
    }

    // Retorna os dados necessários para o frontend
    return res.status(200).json({
      success: true,
      message: "Convite válido.",
      data: {
        propriedade: convite.propriedade.nomePropriedade,
        convidadoPor: convite.convidadoPor.nomeCompleto,
        emailConvidado: convite.emailConvidado,
        userExists: convite.usuarioJaExiste,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao verificar o convite." });
  }
};