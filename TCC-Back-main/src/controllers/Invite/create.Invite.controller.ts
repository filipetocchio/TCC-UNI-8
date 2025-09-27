/**
 * @file create.Invite.controller.ts
 * @description Controller responsável pela criação de convites para adicionar
 * novos usuários a uma propriedade.
 */

// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

/**
 * @name createInviteSchema
 * @description Valida os dados de entrada para a criação de um convite.
 * Garante que o e-mail seja válido e que os IDs e permissões sejam fornecidos.
 */
const createInviteSchema = z.object({
  emailConvidado: z.string().email({ message: "O formato do e-mail do convidado é inválido." }),
  idPropriedade: z.number().int().positive({ message: "O ID da propriedade é obrigatório." }),
  permissao: z.string().min(1, { message: "A permissão é obrigatória." }), // Pode ser evoluído para um z.enum()
});

/**
 * @function createInvite
 * @async
 * @description Manipula a requisição de criação de um novo convite.
 * @param {Request} req - O objeto de requisição do Express.
 * @param {Response} res - O objeto de resposta do Express.
 * @returns {Promise<Response>} Retorna uma resposta JSON indicando sucesso ou falha.
 */
export const createInvite = async (req: Request, res: Response) => {
  try {
    // 1. Validação de Autenticação e Dados de Entrada
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { emailConvidado, idPropriedade, permissao } = createInviteSchema.parse(req.body);
    const { id: idConvidadoPor } = req.user;

    // 2. Verificação de Permissão (Regra de Negócio Crítica)
    // Garante que o usuário que está tentando criar o convite tem a permissão
    // 'proprietario_master' para a propriedade em questão.
    const masterPermission = await prisma.usuariosPropriedades.findFirst({
      where: {
        idUsuario: idConvidadoPor,
        idPropriedade: idPropriedade,
        permissao: 'proprietario_master',
      },
    });

    if (!masterPermission) {
      return res.status(403).json({ success: false, message: "Acesso negado: Apenas proprietários master podem enviar convites para esta propriedade." });
    }

    // 3. Verificação de Duplicidade
    // Impede o envio de um convite para um usuário que já é membro da propriedade.
    const existingUser = await prisma.user.findUnique({ where: { email: emailConvidado } });
    if (existingUser) {
        const isAlreadyMember = await prisma.usuariosPropriedades.findFirst({
            where: { idUsuario: existingUser.id, idPropriedade: idPropriedade }
        });
        if (isAlreadyMember) {
            return res.status(409).json({ success: false, message: "Este usuário já é membro da propriedade." });
        }
    }

    // 4. Geração de Token Seguro e Data de Expiração
    // Utiliza o módulo 'crypto' do Node.js para gerar um token criptograficamente seguro.
    const token = randomBytes(32).toString('hex');
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + 7); // Define a validade para 7 dias.

    // 5. Persistência do Convite
    // Cria o registro do convite no banco de dados com todos os dados gerados.
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

    // 6. Resposta de Sucesso
    // Em uma implementação com e-mails, o envio ocorreria aqui.
    // Para o MVP, retornamos o link para o front-end exibir ou para o usuário copiar.
    const linkConvite = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/convite/${convite.token}`;

    return res.status(201).json({
      success: true,
      message: `Convite criado com sucesso para ${emailConvidado}.`,
      data: { linkConvite },
    });

  } catch (error) {
    // Tratamento de Erros
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    
    // Tratamento de outros erros conhecidos do Prisma ou erros genéricos
    console.error("Erro ao criar convite:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao criar o convite." });
  }
};