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
 * Controller para atualizar a porcentagem de cota de um membro da propriedade.
 * A lógica é executada dentro de uma transação para garantir a integridade dos dados.
 */
export const updateCotaPermission = async (req: Request, res: Response) => {
  try {
    // Garante que o usuário esteja autenticado.
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }

    const { vinculoId, porcentagemCota: novaPorcentagem } = updateCotaSchema.parse({
      ...req.body,
      vinculoId: req.params.vinculoId,
    });
    const idUsuarioRequisitante = req.user.id;

    // A lógica de negócio crítica é encapsulada em uma transação.
    // Ou todas as operações funcionam, ou nenhuma é aplicada.
    await prisma.$transaction(async (tx: TransactionClient) => {
      
      // Busca o vínculo do cotista que será editado para obter o ID da propriedade.
      const vinculoAlvo = await tx.usuariosPropriedades.findUnique({
        where: { id: vinculoId },
      });

      if (!vinculoAlvo) {
        throw new Error("O membro selecionado não foi encontrado.");
      }
      const { idPropriedade } = vinculoAlvo;

      // Valida se o usuário que faz a requisição é um Proprietário Master da propriedade em questão.
      const vinculoMaster = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: idUsuarioRequisitante, idPropriedade, permissao: 'proprietario_master' },
      });

      if (!vinculoMaster) {
        throw new Error("Acesso negado. Apenas proprietários master podem alterar cotas.");
      }

      // Busca todos os membros da propriedade para as validações.
      const todosMembros = await tx.usuariosPropriedades.findMany({
        where: { idPropriedade },
      });

      // REGRA DE NEGÓCIO: Bloqueia a edição se houver apenas um membro.
      if (todosMembros.length <= 1) {
        throw new Error("Não é possível editar a cota do único proprietário. Adicione outro cotista para distribuir as porcentagens.");
      }

      // Calcula a soma das cotas dos outros membros (excluindo o que está sendo editado).
      const somaCotasOutrosMembros = todosMembros.reduce((acc, membro) => {
        return membro.id === vinculoAlvo.id ? acc : acc + membro.porcentagemCota;
      }, 0);

      // REGRA DE NEGÓCIO: A nova porcentagem somada às existentes não pode ultrapassar 100.
      // Usamos 100.01 como margem para evitar erros de ponto flutuante.
      if (somaCotasOutrosMembros + novaPorcentagem > 100.01) {
        const cotaDisponivel = (100 - somaCotasOutrosMembros).toFixed(2);
        throw new Error(`Ajuste inválido. A cota máxima que pode ser atribuída é de ${cotaDisponivel}%.`);
      }

      // Atualiza a cota do membro alvo.
      await tx.usuariosPropriedades.update({
        where: { id: vinculoAlvo.id },
        data: { porcentagemCota: novaPorcentagem },
      });
      
      // Se o master não estiver editando a si mesmo, recalcula a cota dele como o valor restante.
      if (vinculoAlvo.id !== vinculoMaster.id) {
          const novaCotaMaster = 100 - (somaCotasOutrosMembros + novaPorcentagem);
          await tx.usuariosPropriedades.update({
            where: { id: vinculoMaster.id },
            data: { porcentagemCota: novaCotaMaster },
          });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Porcentagem da cota atualizada com sucesso.",
    });

  } catch (error) {
    // Envia mensagens de erro tratadas e amigáveis para o frontend.
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    return res.status(400).json({ success: false, message: errorMessage });
  }
};