// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Define um tipo para o cliente de transação do Prisma para clareza do código.
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Schema de validação para os dados da requisição.
const updateCotaSchema = z.object({
  vinculoId: z.string().transform(val => parseInt(val, 10)),
  porcentagemCota: z.number().min(0, { message: "A porcentagem não pode ser negativa." }).max(100, { message: "A porcentagem não pode exceder 100%." }),
});

/**
 * Atualiza a porcentagem de cota de um membro da propriedade, garantindo
 * que a soma total permaneça 100% ao ajustar a cota do master requisitante.
 */
export const updateCotaPermission = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }

    const { vinculoId, porcentagemCota: novaPorcentagem } = updateCotaSchema.parse({
      ...req.body,
      vinculoId: req.params.vinculoId,
    });
    const idUsuarioRequisitante = req.user.id;

    await prisma.$transaction(async (tx: TransactionClient) => {
      // Busca o vínculo alvo e o vínculo do master que está fazendo a requisição.
      const vinculoAlvo = await tx.usuariosPropriedades.findUnique({ where: { id: vinculoId } });
      if (!vinculoAlvo) throw new Error("O membro selecionado não foi encontrado.");
      
      const { idPropriedade } = vinculoAlvo;
      const vinculoMaster = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: idUsuarioRequisitante, idPropriedade, permissao: 'proprietario_master' },
      });

      if (!vinculoMaster) {
        throw new Error("Acesso negado. Apenas proprietários master podem alterar cotas.");
      }

      // Busca todos os membros para validação.
      const todosMembros = await tx.usuariosPropriedades.findMany({ where: { idPropriedade } });
      if (todosMembros.length <= 1) {
        throw new Error("Não é possível editar a cota do único proprietário.");
      }

      // Cenário 1: O master está editando a cota de outro membro.
      if (vinculoAlvo.id !== vinculoMaster.id) {
        const somaCotasFixas = todosMembros.reduce((acc, membro) => {
          if (membro.id !== vinculoAlvo.id && membro.id !== vinculoMaster.id) {
            return acc + membro.porcentagemCota;
          }
          return acc;
        }, 0);

        const novaCotaMaster = 100 - somaCotasFixas - novaPorcentagem;
        if (novaCotaMaster < 0) {
          const cotaDisponivel = (100 - somaCotasFixas).toFixed(2);
          throw new Error(`Valor inválido. A porcentagem máxima que pode ser atribuída a este membro é de ${cotaDisponivel}%.`);
        }

        // Atualiza o alvo e depois o master.
        await tx.usuariosPropriedades.update({ where: { id: vinculoAlvo.id }, data: { porcentagemCota: novaPorcentagem } });
        await tx.usuariosPropriedades.update({ where: { id: vinculoMaster.id }, data: { porcentagemCota: novaCotaMaster } });

      } else { // Cenário 2: O master está editando a própria cota.
        const somaOutrasCotas = todosMembros.reduce((acc, membro) => {
          return membro.id !== vinculoMaster.id ? acc + membro.porcentagemCota : acc;
        }, 0);

        if (somaOutrasCotas + novaPorcentagem > 100.01) {
          const cotaDisponivel = (100 - somaOutrasCotas).toFixed(2);
          throw new Error(`Valor inválido. A sua cota máxima não pode exceder ${cotaDisponivel}% para manter a soma em 100%.`);
        }
        
        // Atualiza apenas a cota do master.
        await tx.usuariosPropriedades.update({ where: { id: vinculoMaster.id }, data: { porcentagemCota: novaPorcentagem } });
      }
    });

    return res.status(200).json({ success: true, message: "Cotas atualizadas com sucesso." });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    // Retorna um erro 400 (Bad Request) para falhas de lógica de negócio.
    return res.status(400).json({ success: false, message: errorMessage });
  }
};