// D:\Qota-TCC\TCC-Back-main\src\controllers\Invite\verify.Invite.controller.ts
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';

export const verifyInvite = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const convite = await prisma.convite.findUnique({
      where: { token },
      include: {
        propriedade: { select: { nomePropriedade: true } },
        convidadoPor: { select: { nomeCompleto: true } },
      },
    });

    // Validações de segurança
    if (!convite || convite.status !== 'PENDENTE') {
      return res.status(404).json({ success: false, message: "Convite inválido ou já utilizado." });
    }
    if (new Date() > convite.dataExpiracao) {
      // Opcional: atualizar status para EXPIRADO
      await prisma.convite.update({ where: { id: convite.id }, data: { status: 'EXPIRADO' } });
      return res.status(410).json({ success: false, message: "Este convite expirou." });
    }

    // Verifica se o convidado já tem conta
    const userExists = await prisma.user.findUnique({ where: { email: convite.emailConvidado } });

    return res.status(200).json({
      success: true,
      message: "Convite válido.",
      data: {
        propriedade: convite.propriedade.nomePropriedade,
        convidadoPor: convite.convidadoPor.nomeCompleto,
        emailConvidado: convite.emailConvidado,
        userExists: !!userExists, // Retorna true ou false
      },
    });
  } catch (error) {
    // ... (tratamento de erros)
  }
};