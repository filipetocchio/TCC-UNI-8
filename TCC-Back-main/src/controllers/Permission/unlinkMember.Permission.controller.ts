// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Desvincular um Membro por um Proprietário Master
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que permite a um "proprietario_master"
 * remover outro membro de uma propriedade. Esta é uma ação administrativa crítica,
 * executada de forma transacional para garantir a consistência dos dados.
 *
 * O processo é responsável por:
 * 1.  Validar que o requisitante é um proprietário master da propriedade em questão.
 * 2.  Impedir que um master remova a si mesmo por esta rota.
 * 3.  Transferir o número de frações do membro removido para o master que executou a ação.
 * 4.  Recalcular o saldo de diárias do master com base em seu novo total de frações.
 * 5.  Remover permanentemente o vínculo do membro com a propriedade.
 * 6.  Disparar uma notificação em segundo plano para registrar o evento.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'permission.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Schema para validar o ID do vínculo nos parâmetros da rota.
const paramsSchema = z.object({
  vinculoId: z.string().transform((val) => parseInt(val, 10)),
});

/**
 * Processa a remoção de um membro de uma propriedade por um proprietário master.
 */
export const unlinkMemberFromProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: idMasterRequisitante, nomeCompleto: nomeMaster } = req.user;
    const { vinculoId } = paramsSchema.parse(req.params);

    let notificationPayload;

    // --- 2. Execução da Lógica Transacional ---
    await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Busca dos Vínculos e da Propriedade
      const vinculoParaRemover = await tx.usuariosPropriedades.findUnique({
        where: { id: vinculoId },
        include: { usuario: true },
      });
      if (!vinculoParaRemover) throw new Error('O membro que você está tentando remover não foi encontrado.');
      
      const { idPropriedade, numeroDeFracoes, usuario: usuarioRemovido } = vinculoParaRemover;

      const vinculoMaster = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: idMasterRequisitante, idPropriedade, permissao: 'proprietario_master' },
        include: { propriedade: true },
      });
      if (!vinculoMaster) throw new Error('Acesso negado. Apenas proprietários master podem remover membros.');

      if (vinculoParaRemover.idUsuario === idMasterRequisitante) {
        throw new Error("Você não pode remover a si mesmo. Use a função 'Sair da Propriedade'.");
      }

      // 2.2. Transferência de Frações e Recálculo de Saldo de Diárias
      const novoNumeroDeFracoesMaster = vinculoMaster.numeroDeFracoes + numeroDeFracoes;
      
      // Lógica pro-rata para recalcular o saldo do master com base nas novas frações.
      const hoje = new Date();
      const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);
      const fimDoAno = new Date(hoje.getFullYear(), 11, 31);
      const diasTotaisNoAno = (fimDoAno.getTime() - inicioDoAno.getTime()) / (1000 * 3600 * 24) + 1;
      const diasRestantesNoAno = (fimDoAno.getTime() - hoje.getTime()) / (1000 * 3600 * 24) + 1;
      const proporcaoAnoRestante = diasRestantesNoAno > 0 ? diasRestantesNoAno / diasTotaisNoAno : 0;

      const saldoAnualTotalMaster = novoNumeroDeFracoesMaster * vinculoMaster.propriedade.diariasPorFracao;
      const novoSaldoProRataMaster = saldoAnualTotalMaster * proporcaoAnoRestante;

      await tx.usuariosPropriedades.update({
        where: { id: vinculoMaster.id },
        data: { 
            numeroDeFracoes: { increment: numeroDeFracoes },
            saldoDiariasAtual: novoSaldoProRataMaster
        },
      });

      // 2.3. Remoção do Vínculo do Membro
      await tx.usuariosPropriedades.delete({ where: { id: vinculoId } });

      // 2.4. Preparação da Notificação
      notificationPayload = {
        idPropriedade,
        idAutor: idMasterRequisitante,
        mensagem: `O proprietário master '${nomeMaster}' removeu o cotista '${usuarioRemovido.nomeCompleto}' da propriedade.`,
      };
    });

    // --- 3. Disparo da Notificação (Desempenho) ---
    if (notificationPayload) {
      createNotification(notificationPayload).catch((err) => {
        logEvents(`Falha ao criar notificação para desvinculação de membro: ${err.message}`, LOG_FILE);
      });
    }

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'O membro foi desvinculado da propriedade com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao desvincular membro: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao desvincular o membro.',
    });
  }
};