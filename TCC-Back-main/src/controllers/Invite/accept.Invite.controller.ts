/**
 * @file accept.Invite.controller.ts
 * @description Controller para o processo de aceitação de um convite por um usuário autenticado.
 */
// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * @function acceptInvite
 * @async
 * @description Manipula a requisição de um usuário para aceitar um convite.
 * @param {Request} req - O objeto de requisição do Express, contendo o token e o usuário autenticado.
 * @param {Response} res - O objeto de resposta do Express.
 * @returns {Promise<Response>} Retorna uma resposta JSON indicando sucesso ou falha.
 */
export const acceptInvite = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    // 1. Validação de Autenticação
    // Garante que o middleware 'protect' adicionou o objeto 'user' à requisição.
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: idUsuarioLogado, email: emailUsuarioLogado } = req.user;

    // 2. Busca e Validação do Convite
    // Procura por um convite que corresponda ao token, esteja PENDENTE e não tenha expirado.
    const convite = await prisma.convite.findFirst({
      where: {
        token,
        status: 'PENDENTE',
        dataExpiracao: { gte: new Date() }, // gte = Greater Than or Equal (maior ou igual a)
      },
    });

    if (!convite) {
      return res.status(404).json({ success: false, message: "Convite inválido, expirado ou já utilizado." });
    }

    // 3. Verificação de Segurança Crítica
    // Compara o e-mail do usuário logado com o e-mail para o qual o convite foi destinado.
    if (convite.emailConvidado.toLowerCase() !== emailUsuarioLogado.toLowerCase()) {
      return res.status(403).json({ success: false, message: "Acesso negado: Este convite foi destinado a outro e-mail." });
    }

    // 4. Transação Atômica para garantir a integridade dos dados
    // Esta operação garante que ou AMBAS as escritas no banco (criar o vínculo e atualizar o convite)
    // são bem-sucedidas, ou NENHUMA delas é aplicada em caso de erro.
    await prisma.$transaction(async (tx) => {
      // Cria a associação entre o usuário e a propriedade
      await tx.usuariosPropriedades.create({
        data: {
          idUsuario: idUsuarioLogado,
          idPropriedade: convite.idPropriedade,
          permissao: convite.permissao,
        },
      });
      // Atualiza o status do convite para evitar reutilização
      await tx.convite.update({
        where: { id: convite.id },
        data: { status: 'ACEITO', aceitoEm: new Date() },
      });
    });

    return res.status(200).json({ success: true, message: "Convite aceito! A propriedade foi adicionada à sua conta." });
  
  } catch (error) {
    // Tratamento de Erro Específico do Prisma (P2002: Unique constraint failed)
    // Ocorre se o usuário tentar aceitar um convite para uma propriedade à qual ele já está vinculado.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Atualiza o convite para ACEITO para que não fique pendente indefinidamente.
        await prisma.convite.update({ where: { token: req.params.token }, data: { status: 'ACEITO' }});
        return res.status(409).json({ success: false, message: 'Você já é membro desta propriedade.' });
    }

    // Tratamento de Erros Genéricos
    console.error("Erro ao aceitar convite:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao processar o convite." });
  }
};