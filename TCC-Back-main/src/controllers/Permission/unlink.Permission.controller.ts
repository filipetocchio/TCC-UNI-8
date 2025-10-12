// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createNotification } from '../../utils/notification.service';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

const paramsSchema = z.object({
  vinculoId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Permite que um usuário autenticado se desvincule de uma propriedade,
 * aplicando regras de negócio específicas para cotistas comuns e masters.
 */
export const unlinkUserFromProperty = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: idUsuarioLogado, nomeCompleto: nomeUsuario } = req.user;
    const { vinculoId } = paramsSchema.parse(req.params);

    await prisma.$transaction(async (tx: TransactionClient) => {
      const vinculoParaRemover = await tx.usuariosPropriedades.findUnique({
        where: { id: vinculoId },
        include: { propriedade: true }
      });

      if (!vinculoParaRemover) throw new Error("Vínculo com a propriedade não encontrado.");
      if (vinculoParaRemover.idUsuario !== idUsuarioLogado) throw new Error("Acesso negado. Você só pode remover o seu próprio vínculo.");

      const { idPropriedade, porcentagemCota, permissao } = vinculoParaRemover;

      if (permissao === 'proprietario_comum') {
        // --- FLUXO PARA COTISTA COMUM ---
        const masterReceptor = await tx.usuariosPropriedades.findFirst({
          where: { idPropriedade, permissao: 'proprietario_master' },
          orderBy: { createdAt: 'asc' },
        });
        if (!masterReceptor) throw new Error("Operação falhou: não há um proprietário master para receber a cota.");
        
        await tx.usuariosPropriedades.update({
          where: { id: masterReceptor.id },
          data: { porcentagemCota: { increment: porcentagemCota } },
        });

      } else if (permissao === 'proprietario_master') {
        // --- FLUXO PARA PROPRIETÁRIO MASTER ---
        const remainingMasters = await tx.usuariosPropriedades.findMany({
          where: { idPropriedade, permissao: 'proprietario_master', id: { not: vinculoId } },
          orderBy: { createdAt: 'asc' },
        });

        if (remainingMasters.length === 0) {
            const totalMembers = await tx.usuariosPropriedades.count({ where: { idPropriedade } });
            if (totalMembers > 1) {
                throw new Error("Ação bloqueada. Você é o único proprietário master. Promova outro cotista a master antes de se desvincular.");
            } else {
                throw new Error("Ação bloqueada. Você é o único dono. Para se desfazer da propriedade, utilize a função 'Excluir Propriedade'.");
            }
        }

        // Distribui a cota entre os masters restantes
        const cotaPorMaster = porcentagemCota / remainingMasters.length;
        for (const master of remainingMasters) {
          await tx.usuariosPropriedades.update({
            where: { id: master.id },
            data: { porcentagemCota: { increment: cotaPorMaster } },
          });
        }
      }

      // Remove definitivamente o vínculo do usuário que está saindo.
      await tx.usuariosPropriedades.delete({ where: { id: vinculoId } });

      await createNotification({
        idPropriedade,
        idAutor: idUsuarioLogado,
        mensagem: `O usuário '${nomeUsuario}' se desvinculou da propriedade '${vinculoParaRemover.propriedade.nomePropriedade}'.`,
      });
    });

    return res.status(200).json({ success: true, message: "Você foi desvinculado da propriedade com sucesso." });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    return res.status(400).json({ success: false, message: errorMessage });
  }
};