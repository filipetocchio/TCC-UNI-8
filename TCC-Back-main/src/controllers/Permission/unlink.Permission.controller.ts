// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

const unlinkSchema = z.object({
  vinculoId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Permite que um usuário autenticado se desvincule de uma propriedade.
 * A cota do usuário é transferida de volta para o primeiro proprietário master.
 */
export const unlinkUserFromProperty = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }

    const { vinculoId } = unlinkSchema.parse(req.params);
    const { id: idUsuarioLogado } = req.user;

    await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Busca o vínculo que o usuário deseja remover.
      const vinculoParaRemover = await tx.usuariosPropriedades.findUnique({
        where: { id: vinculoId },
      });

      if (!vinculoParaRemover) {
        throw new Error("Vínculo com a propriedade não encontrado.");
      }

      // 2. Validação de segurança: Garante que o usuário logado só pode remover a si mesmo.
      if (vinculoParaRemover.idUsuario !== idUsuarioLogado) {
        throw new Error("Acesso negado. Você só pode se desvincular da propriedade.");
      }

      const { idPropriedade, porcentagemCota } = vinculoParaRemover;

      // 3. Regra de negócio: Impede que o último proprietário master abandone a propriedade.
      if (vinculoParaRemover.permissao === 'proprietario_master') {
        const masterCount = await tx.usuariosPropriedades.count({
          where: { idPropriedade, permissao: 'proprietario_master' },
        });
        if (masterCount <= 1) {
          throw new Error("Ação bloqueada. O último proprietário master não pode se desvincular da propriedade.");
        }
      }

      // 4. Encontra o primeiro proprietário master da propriedade para receber a cota de volta.
      const masterReceptor = await tx.usuariosPropriedades.findFirst({
        where: { idPropriedade, permissao: 'proprietario_master' },
        orderBy: { createdAt: 'asc' }, // Pega o mais antigo
      });

      if (!masterReceptor) {
        throw new Error("Não foi encontrado um proprietário master para receber a cota. Ação cancelada por segurança.");
      }

      // 5. Devolve a cota para o proprietário master.
      await tx.usuariosPropriedades.update({
        where: { id: masterReceptor.id },
        data: { porcentagemCota: { increment: porcentagemCota } },
      });

      // 6. Remove definitivamente o vínculo do usuário.
      await tx.usuariosPropriedades.delete({
        where: { id: vinculoId },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Você foi desvinculado da propriedade com sucesso.",
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(400).json({ success: false, message: errorMessage });
  }
};