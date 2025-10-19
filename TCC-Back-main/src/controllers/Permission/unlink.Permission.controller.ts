// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Desvinculação de Usuário de uma Propriedade
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que permite a um usuário autenticado
 * remover seu próprio vínculo de uma propriedade. A operação é complexa, segura e
 * otimizada para performance.
 *
 * O processo é responsável por:
 * 1.  Executar todas as modificações de dados dentro de uma transação atômica.
 * 2.  Aplicar regras de negócio críticas, como a transferência de frações para
 * o(s) proprietário(s) master remanescente(s).
 * 3.  Recalcular o saldo de diárias de quem recebe as frações.
 * 4.  Bloquear a ação caso o último proprietário master tente se desvincular.
 * 5.  Disparar uma notificação em segundo plano para os membros da propriedade.
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

// Define a estrutura de dados para o payload da notificação.
interface NotificationPayload {
  idPropriedade: number;
  nomePropriedade: string;
}

// Schema para validar o ID do vínculo nos parâmetros da rota.
const paramsSchema = z.object({
  vinculoId: z.string().transform((val) => parseInt(val, 10)),
});

/**
 * Calcula o saldo de diárias pro-rata para um determinado número de frações.
 * @param numeroDeFracoes O total de frações do membro.
 * @param diariasPorFracao O valor de diárias por fração da propriedade.
 * @returns O saldo de diárias proporcional ao restante do ano.
 */
const calcularSaldoProRata = (numeroDeFracoes: number, diariasPorFracao: number): number => {
    const hoje = new Date();
    const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);
    const fimDoAno = new Date(hoje.getFullYear(), 11, 31);
    const diasTotaisNoAno = (fimDoAno.getTime() - inicioDoAno.getTime()) / (1000 * 3600 * 24) + 1;
    const diasRestantesNoAno = Math.max(0, (fimDoAno.getTime() - hoje.getTime()) / (1000 * 3600 * 24) + 1);
    const proporcaoAnoRestante = diasRestantesNoAno / diasTotaisNoAno;
    
    const saldoAnualTotal = numeroDeFracoes * diariasPorFracao;
    return saldoAnualTotal * proporcaoAnoRestante;
};

/**
 * Processa a desvinculação de um usuário de uma propriedade.
 */
export const unlinkUserFromProperty = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: idUsuarioLogado, nomeCompleto: nomeUsuario } = req.user;
    const { vinculoId } = paramsSchema.parse(req.params);

    // --- 2. Execução da Lógica Transacional ---
    // A transação retorna os dados necessários para a notificação.
    const notificationPayload = await prisma.$transaction(async (tx: TransactionClient): Promise<NotificationPayload> => {
      // 2.1. Busca e Validação do Vínculo e da Autorização do Usuário
      const vinculoParaRemover = await tx.usuariosPropriedades.findUnique({
        where: { id: vinculoId },
        include: { propriedade: true },
      });

      if (!vinculoParaRemover) throw new Error('Vínculo com a propriedade não encontrado.');
      if (vinculoParaRemover.idUsuario !== idUsuarioLogado) throw new Error('Acesso negado. Você só pode remover o seu próprio vínculo.');

      const { idPropriedade, numeroDeFracoes, permissao, propriedade } = vinculoParaRemover;

      // 2.2. Lógica de Transferência de Frações para Cotista Comum
      if (permissao === 'proprietario_comum') {
        const masterReceptor = await tx.usuariosPropriedades.findFirst({
          where: { idPropriedade, permissao: 'proprietario_master' },
          orderBy: { createdAt: 'asc' },
        });
        if (!masterReceptor) throw new Error('Operação falhou: não há um proprietário master para receber as frações.');
        
        const novoTotalFracoesMaster = masterReceptor.numeroDeFracoes + numeroDeFracoes;
        const novoSaldoMaster = calcularSaldoProRata(novoTotalFracoesMaster, propriedade.diariasPorFracao);

        await tx.usuariosPropriedades.update({
          where: { id: masterReceptor.id },
          data: { 
            numeroDeFracoes: { increment: numeroDeFracoes },
            saldoDiariasAtual: novoSaldoMaster,
          },
        });
      }
      // 2.3. Lógica de Transferência de Frações para Proprietário Master
      else if (permissao === 'proprietario_master') {
        const remainingMasters = await tx.usuariosPropriedades.findMany({
          where: { idPropriedade, permissao: 'proprietario_master', id: { not: vinculoId } },
          orderBy: { createdAt: 'asc' },
        });

        if (remainingMasters.length === 0) {
          const totalMembers = await tx.usuariosPropriedades.count({ where: { idPropriedade } });
          if (totalMembers > 1) throw new Error('Ação bloqueada. Você é o único proprietário master. Promova outro cotista antes de sair.');
          else throw new Error("Ação bloqueada. Você é o único dono. Para se desfazer do bem, utilize a função 'Excluir Propriedade'.");
        }

        const baseFracoes = Math.floor(numeroDeFracoes / remainingMasters.length);
        let fracoesRestantes = numeroDeFracoes % remainingMasters.length;
        
        const updatePromises = remainingMasters.map(master => {
            const fracoesAdicionais = baseFracoes + (fracoesRestantes > 0 ? 1 : 0);
            if (fracoesRestantes > 0) fracoesRestantes--;

            const novoTotalFracoes = master.numeroDeFracoes + fracoesAdicionais;
            const novoSaldo = calcularSaldoProRata(novoTotalFracoes, propriedade.diariasPorFracao);
            
            return tx.usuariosPropriedades.update({
                where: { id: master.id },
                data: { 
                    numeroDeFracoes: { increment: fracoesAdicionais },
                    saldoDiariasAtual: novoSaldo,
                },
            });
        });
        await Promise.all(updatePromises);
      }

      // 2.4. Remoção Definitiva do Vínculo
      await tx.usuariosPropriedades.delete({ where: { id: vinculoId } });
      
      // Retorna os dados para a notificação.
      return { idPropriedade, nomePropriedade: propriedade.nomePropriedade };
    });

    // --- 3. Disparo da Notificação (Desempenho) ---
    createNotification({
      idPropriedade: notificationPayload.idPropriedade,
      idAutor: idUsuarioLogado,
      mensagem: `O usuário '${nomeUsuario}' se desvinculou da propriedade '${notificationPayload.nomePropriedade}'.`,
    }).catch(err => {
        logEvents(`Falha ao criar notificação para desvinculação de usuário: ${err.message}`, LOG_FILE);
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({ success: true, message: "Você foi desvinculado da propriedade com sucesso." });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao desvincular usuário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor.',
    });
  }
};