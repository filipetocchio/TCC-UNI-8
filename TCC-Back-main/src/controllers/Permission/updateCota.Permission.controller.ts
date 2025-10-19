// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Frações de um Membro
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que permite a um "proprietario_master"
 * ajustar o número de frações de um membro da propriedade. A operação é segura,
 * transacional e otimizada para performance.
 *
 * O processo é responsável por:
 * 1.  Validar que o requisitante é um proprietário master da propriedade.
 * 2.  Garantir que a nova distribuição de frações não exceda o total definido para a propriedade.
 * 3.  Atualizar o número de frações do membro alvo.
 * 4.  Recalcular e atualizar o saldo de diárias do membro com base em sua nova
 * quantidade de frações, de forma proporcional ao restante do ano (pro-rata).
 * 5.  Disparar uma notificação em segundo plano para registrar o evento.
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

// Schema de validação para os dados da requisição.
const updateFracoesSchema = z.object({
  vinculoId: z.string().transform((val) => parseInt(val, 10)),
  numeroDeFracoes: z.number().int().min(0, { message: 'O número de frações não pode ser negativo.' }),
});

/**
 * Processa a atualização do número de frações de um membro.
 */
export const updateCotaPermission = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: idUsuarioRequisitante, nomeCompleto: nomeRequisitante } = req.user;

    const { vinculoId, numeroDeFracoes: novoNumeroDeFracoes } =
      updateFracoesSchema.parse({
        ...req.body,
        vinculoId: req.params.vinculoId,
      });

    let notificationPayload;

    // --- 2. Execução da Lógica Transacional de Frações ---
    await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Busca dos Vínculos e da Propriedade
      const vinculoAlvo = await tx.usuariosPropriedades.findUnique({
        where: { id: vinculoId },
        include: { usuario: { select: { nomeCompleto: true } } },
      });
      if (!vinculoAlvo) throw new Error('O membro selecionado não foi encontrado.');

      const { idPropriedade } = vinculoAlvo;
      const propriedade = await tx.propriedades.findUnique({ where: { id: idPropriedade } });
      if (!propriedade) throw new Error('Propriedade não encontrada.');

      // 2.2. Validação de Autorização (Segurança)
      const vinculoMaster = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: idUsuarioRequisitante, idPropriedade, permissao: 'proprietario_master' },
      });
      if (!vinculoMaster) {
        throw new Error('Acesso negado. Apenas proprietários master podem alterar frações.');
      }

      // 2.3. Validação de Integridade das Frações (Regra de Negócio)
      const todosMembros = await tx.usuariosPropriedades.findMany({ where: { idPropriedade } });
      const somaAtualFracoes = todosMembros.reduce((acc, membro) => acc + membro.numeroDeFracoes, 0);
      const novaSomaTotal = (somaAtualFracoes - vinculoAlvo.numeroDeFracoes) + novoNumeroDeFracoes;

      if (novaSomaTotal > propriedade.totalFracoes) {
        const fracoesDisponiveis = propriedade.totalFracoes - (somaAtualFracoes - vinculoAlvo.numeroDeFracoes);
        throw new Error(`Operação inválida. O número total de frações distribuídas (${novaSomaTotal}) excederia o limite da propriedade (${propriedade.totalFracoes}). Frações disponíveis: ${fracoesDisponiveis}.`);
      }

      // 2.4. Recálculo do Saldo de Diárias (Lógica Pro-Rata)
      const hoje = new Date();
      const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);
      const fimDoAno = new Date(hoje.getFullYear(), 11, 31);
      const diasTotaisNoAno = (fimDoAno.getTime() - inicioDoAno.getTime()) / (1000 * 3600 * 24) + 1;
      const diasRestantesNoAno = (fimDoAno.getTime() - hoje.getTime()) / (1000 * 3600 * 24) + 1;
      const proporcaoAnoRestante = diasRestantesNoAno > 0 ? diasRestantesNoAno / diasTotaisNoAno : 0;
      
      const saldoAnualTotal = novoNumeroDeFracoes * propriedade.diariasPorFracao;
      const novoSaldoProRata = saldoAnualTotal * proporcaoAnoRestante;

      // 2.5. Atualização do Vínculo do Membro Alvo
      await tx.usuariosPropriedades.update({
        where: { id: vinculoAlvo.id },
        data: { 
            numeroDeFracoes: novoNumeroDeFracoes,
            saldoDiariasAtual: novoSaldoProRata
        },
      });

      // 2.6. Preparação da Notificação
      notificationPayload = {
        idPropriedade,
        idAutor: idUsuarioRequisitante,
        mensagem: `As frações de '${vinculoAlvo.usuario.nomeCompleto}' foram atualizadas para ${novoNumeroDeFracoes} por '${nomeRequisitante}'.`,
      };
    });

    // --- 3. Disparo da Notificação (Desempenho) ---
    if (notificationPayload) {
        createNotification(notificationPayload).catch(err => {
            logEvents(`Falha ao criar notificação para atualização de frações: ${err.message}`, LOG_FILE);
        });
    }

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({ success: true, message: "As frações do membro foram atualizadas com sucesso." });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao atualizar frações: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao atualizar as frações.',
    });
  }
};