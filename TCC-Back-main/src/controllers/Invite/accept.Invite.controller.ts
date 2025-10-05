// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

// Define um tipo para o cliente de transação do Prisma, melhorando a legibilidade.
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

/**
 * Manipula a aceitação de um convite, realizando a transferência de cota
 * e a criação do vínculo do novo membro de forma transacional e segura.
 */
export const acceptInvite = async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!req.user) {
    return res.status(401).json({ success: false, message: "Usuário não autenticado." });
  }
  const { id: idUsuarioLogado, email: emailUsuarioLogado } = req.user;
  
  try {
    // A lógica é encapsulada em uma transação para garantir a consistência dos dados.
    await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Busca o convite válido e pendente.
      const convite = await tx.convite.findFirst({
        where: {
          token,
          status: 'PENDENTE',
          dataExpiracao: { gte: new Date() },
        },
      });

      if (!convite) {
        throw new Error("Convite inválido, expirado ou já utilizado.");
      }
      if (convite.emailConvidado.toLowerCase() !== emailUsuarioLogado.toLowerCase()) {
        throw new Error("Acesso negado: Este convite foi destinado a outro e-mail.");
      }

      // 2. Busca o vínculo do master que enviou o convite.
      const masterLink = await tx.usuariosPropriedades.findFirst({
          where: {
              idUsuario: convite.idConvidadoPor,
              idPropriedade: convite.idPropriedade,
          }
      });

      if (!masterLink) {
        throw new Error("O usuário que o convidou não é mais membro desta propriedade.");
      }

      // 3. Validação final de segurança: o master ainda possui cota suficiente?
      if (masterLink.porcentagemCota < convite.porcentagemCota) {
          throw new Error(`O proprietário master não possui cota suficiente (${masterLink.porcentagemCota}%) para ceder.`);
      }

      // 4. Subtrai a porcentagem da cota do master.
      await tx.usuariosPropriedades.update({
          where: { id: masterLink.id },
          data: { porcentagemCota: { decrement: convite.porcentagemCota } }
      });

      // 5. Cria o novo vínculo para o usuário que aceitou o convite.
      await tx.usuariosPropriedades.create({
        data: {
          idUsuario: idUsuarioLogado,
          idPropriedade: convite.idPropriedade,
          permissao: convite.permissao,
          porcentagemCota: convite.porcentagemCota,
        },
      });

      // 6. Finaliza o convite, atualizando seu status.
      await tx.convite.update({
        where: { id: convite.id },
        data: { status: 'ACEITO', aceitoEm: new Date() },
      });
    });

    return res.status(200).json({ 
        success: true, 
        message: "Convite aceito! A propriedade foi adicionada à sua conta.",
    });
  
  } catch (error) {
    // Trata o caso específico de o usuário já ser membro.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await prisma.convite.update({ where: { token }, data: { status: 'ACEITO' }});
        return res.status(409).json({ success: false, message: 'Você já é membro desta propriedade.' });
    }

    const errorMessage = error instanceof Error ? error.message : "Erro interno ao processar o convite.";
    return res.status(400).json({ success: false, message: errorMessage });
  }
};