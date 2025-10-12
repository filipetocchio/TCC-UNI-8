// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createNotification } from '../../utils/notification.service';

// Definição de tipo para o cliente de transação do Prisma, visando a legibilidade do código.
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Schema para validação e conversão do ID do vínculo recebido via parâmetros da rota.
const paramsSchema = z.object({
  vinculoId: z.string().transform(val => parseInt(val, 10)),
});

/**
 * Controller para desvincular um membro de uma propriedade.
 * Apenas um 'proprietario_master' pode executar esta ação. A cota do membro removido
 * é automaticamente transferida para o master que realiza a operação.
 */
export const unlinkMemberFromProperty = async (req: Request, res: Response) => {
  try {
    // Validação de autenticação do usuário requisitante.
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }

    // Extração de dados do usuário autenticado a partir do token.
    const { id: idMasterRequisitante, nomeCompleto: nomeMaster } = req.user;
    // Validação e extração do ID do vínculo a partir dos parâmetros da requisição.
    const { vinculoId } = paramsSchema.parse(req.params);

    // Variável para armazenar os dados da notificação, a ser enviada após a transação.
    let notificationPayload;

    // Início da transação para garantir a atomicidade das operações críticas no banco de dados.
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Etapa 1: Localiza o registro do vínculo que será removido, incluindo dados do usuário associado.
      const vinculoParaRemover = await tx.usuariosPropriedades.findUnique({
        where: { id: vinculoId },
        include: { usuario: true }
      });

      // Validação da existência do vínculo no banco de dados.
      if (!vinculoParaRemover) {
        throw new Error("O membro que você está tentando remover não foi encontrado.");
      }
      const { idPropriedade, porcentagemCota, usuario: usuarioRemovido } = vinculoParaRemover;

      // Etapa 2: Confirma que o usuário requisitante possui permissão 'proprietario_master' na propriedade.
      const vinculoMaster = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: idMasterRequisitante, idPropriedade, permissao: 'proprietario_master' },
      });

      // Validação de permissão. Apenas um master pode desvincular outros membros.
      if (!vinculoMaster) {
        throw new Error("Acesso negado. Apenas proprietários master podem remover membros.");
      }

      // Etapa 3: Regra de negócio que impede o master de se auto-remover por esta rota específica.
      if (vinculoParaRemover.idUsuario === idMasterRequisitante) {
        throw new Error("Você não pode remover a si mesmo. Use a função 'Desvincular da Propriedade' na página de detalhes.");
      }
      
      // Etapa 4: Transfere a cota do membro removido para o master, incrementando seu valor.
      await tx.usuariosPropriedades.update({
        where: { id: vinculoMaster.id },
        data: { porcentagemCota: { increment: porcentagemCota } },
      });

      // Etapa 5: Exclui permanentemente o registro do vínculo do membro com a propriedade.
      await tx.usuariosPropriedades.delete({
        where: { id: vinculoId },
      });

      // Monta o payload para a notificação, que será processada fora do escopo transacional.
      notificationPayload = {
        idPropriedade,
        idAutor: idMasterRequisitante,
        mensagem: `O proprietário master '${nomeMaster}' removeu o cotista '${usuarioRemovido.nomeCompleto}' da propriedade.`,
      };
    });

    // Etapa 6: Envia a notificação após o sucesso da transação, para não impactar seu tempo de execução.
    if (notificationPayload) {
      await createNotification(notificationPayload);
    }

    // Retorna uma resposta de sucesso ao cliente.
    return res.status(200).json({
      success: true,
      message: "Cotista desvinculado com sucesso.",
    });

  } catch (error) {
    // Bloco de tratamento de erros para a operação.
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor.";
    // Registra o erro detalhado no console do servidor para fins de depuração.
    console.error(`Falha ao desvincular membro: ${errorMessage}`, error);
    // Retorna uma resposta de erro ao cliente.
    return res.status(400).json({ success: false, message: errorMessage });
  }
};