// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';

/**
 * Schema de validação para os dados de entrada da criação de um convite.
 * Garante que todos os campos necessários sejam fornecidos e formatados corretamente.
 */
const createInviteSchema = z.object({
  emailConvidado: z.string().email({ message: "O formato do e-mail é inválido." }),
  idPropriedade: z.number().int().positive(),
  permissao: z.enum(['proprietario_master', 'proprietario_comum']),
  porcentagemCota: z.number().min(0, "A cota não pode ser negativa.").max(100, "A cota não pode exceder 100%."),
});

/**
 * Manipula a criação de um novo convite para uma propriedade.
 * Este processo inclui validação de permissão, verificação de cota disponível
 * e registro se o usuário convidado já possui uma conta.
 */
export const createInvite = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }

    const { emailConvidado, idPropriedade, permissao, porcentagemCota } = createInviteSchema.parse(req.body);
    const { id: idConvidadoPor } = req.user;

    // Valida se o usuário que está fazendo a requisição é um proprietário master da propriedade.
    const masterLink = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: idConvidadoPor,
        idPropriedade: idPropriedade,
        permissao: 'proprietario_master',
      },
    });

    if (!masterLink) {
      return res.status(403).json({ success: false, message: "Acesso negado: Apenas proprietários master podem enviar convites." });
    }
    
    // Valida se o proprietário master possui cota suficiente para ceder ao novo membro.
    if (masterLink.porcentagemCota < porcentagemCota) {
        return res.status(400).json({ success: false, message: `Você não pode ceder ${porcentagemCota}% pois possui apenas ${masterLink.porcentagemCota}%.`});
    }

    // Verifica se o usuário a ser convidado já existe no sistema.
    const invitedUserExists = await prisma.user.findUnique({
      where: { email: emailConvidado },
    });

    if (invitedUserExists) {
      // Se o usuário já existe, verifica se ele já não é membro desta propriedade.
      const isAlreadyMember = await prisma.usuariosPropriedades.findFirst({
        where: { idUsuario: invitedUserExists.id, idPropriedade: idPropriedade }
      });
      if (isAlreadyMember) {
        return res.status(409).json({ success: false, message: "Este usuário já é membro da propriedade." });
      }
    }

    // Gera um token criptograficamente seguro para o convite.
    const token = randomBytes(32).toString('hex');
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 7); // Define a validade para 7 dias.

    // Cria o registro do convite no banco de dados.
    const convite = await prisma.convite.create({
      data: {
        token,
        emailConvidado,
        idPropriedade,
        idConvidadoPor,
        permissao,
        porcentagemCota,
        usuarioJaExiste: !!invitedUserExists,
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
    
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao criar o convite." });
  }
};