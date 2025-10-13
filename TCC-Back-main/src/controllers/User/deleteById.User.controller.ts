// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const deleteUserByIdSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'O ID do usuário é inválido.' }),
});

/**
 * Realiza o encerramento (soft delete) e a anonimização de uma conta de usuário.
 * Ao ser executado, o registro do usuário é marcado como excluído e seus dados
 * de identificação únicos (e-mail, CPF) são ofuscados para liberar as credenciais
 * para futuros cadastros, mantendo a integridade do histórico do sistema.
 * @param req - O objeto de requisição do Express.
 * @param res - O objeto de resposta do Express.
 */
export const deleteUserById = async (req: Request, res: Response) => {
  try {
    const { id } = deleteUserByIdSchema.parse(req.params);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.',
      });
    }

    // Prepara os dados anonimizados. Adiciona um prefixo com o timestamp para garantir
    // que os novos valores de e-mail e CPF sejam sempre únicos no banco de dados.
    const timestamp = Date.now();
    const anonymizedEmail = `deleted_${timestamp}_${user.email}`;
    const anonymizedCpf = `deleted_${timestamp}_${user.cpf}`;

    // Atualiza o registro do usuário, marcando-o como excluído e anonimizando os campos únicos.
    await prisma.user.update({
      where: { id },
      data: { 
        excludedAt: new Date(),
        email: anonymizedEmail,
        cpf: anonymizedCpf,
        refreshToken: null, // Invalida qualquer sessão ativa.
        nomeCompleto: 'Usuário Removido', // Ofusca o nome.
        telefone: null, // Remove informações de contato.
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Conta de usuário encerrada com sucesso.',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    console.error(`Erro ao encerrar conta do usuário ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
    });
  }
};