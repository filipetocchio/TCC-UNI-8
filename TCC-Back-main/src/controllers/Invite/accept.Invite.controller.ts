// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Aceitação de Convite
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que um usuário autenticado utiliza
 * para aceitar um convite para se juntar a uma propriedade.
 *
 * A operação é altamente crítica e otimizada para performance:
 * 1.  Executa todas as modificações de dados (transferência de frações, recálculo
 * de saldos, criação de vínculo) dentro de uma transação atômica.
 * 2.  Após o sucesso da transação, a criação da notificação é disparada em
 * segundo plano (padrão "fire-and-forget") para não atrasar a resposta ao usuário.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tipo para o cliente de transação.
const LOG_FILE = 'invite.log';
type TransactionClient = Omit<Prisma.TransactionClient, '$commit' | '$rollback'>;

// Schema para validar o token nos parâmetros da rota.
const paramsSchema = z.object({
  token: z.string().min(1, 'O token do convite é obrigatório.'),
});

/**
 * Processa a aceitação de um convite por um usuário autenticado.
 */
export const acceptInvite = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: idUsuarioLogado, email: emailUsuarioLogado, nomeCompleto: nomeNovoMembro } = req.user;
    const { token } = paramsSchema.parse(req.params);

    // --- 2. Execução da Lógica Transacional de Aceite ---
    // A transação retorna os dados necessários para a notificação.
    const notificationPayload = await prisma.$transaction(async (tx: TransactionClient) => {
      // 2.1. Validação do Convite
      const convite = await tx.convite.findFirst({
        where: { token, status: 'PENDENTE', dataExpiracao: { gte: new Date() } },
        include: { propriedade: true },
      });

      if (!convite) throw new Error('Convite inválido, expirado ou já utilizado.');
      if (!emailUsuarioLogado || convite.emailConvidado.toLowerCase() !== emailUsuarioLogado.toLowerCase()) {
        throw new Error('Acesso negado: Este convite foi destinado a outro e-mail.');
      }

      // 2.2. Validação do Convidante e suas Frações
      const masterLink = await tx.usuariosPropriedades.findFirst({
        where: { idUsuario: convite.idConvidadoPor, idPropriedade: convite.idPropriedade, permissao: 'proprietario_master' },
      });

      if (!masterLink) throw new Error('O usuário que o convidou não é mais um proprietário master desta propriedade.');
      if (masterLink.numeroDeFracoes < convite.numeroDeFracoes) {
        throw new Error(`O proprietário que enviou o convite não possui frações suficientes (${masterLink.numeroDeFracoes}) para ceder.`);
      }

// 2.3. Lógica de Saldo de Diárias (Corrigida)
      const hoje = new Date();
      const inicioDoAno = new Date(hoje.getFullYear(), 0, 1);
      const fimDoAno = new Date(hoje.getFullYear(), 11, 31);
      const diasTotaisNoAno = (fimDoAno.getTime() - inicioDoAno.getTime()) / (1000 * 3600 * 24) + 1;
      const diasRestantesNoAno = Math.max(0, (fimDoAno.getTime() - hoje.getTime()) / (1000 * 3600 * 24) + 1);
      const proporcaoAnoRestante = diasRestantesNoAno / diasTotaisNoAno;
      
      // Calcula o direito anual total das frações que estão sendo transferidas.
      const saldoAnualTransferido = convite.numeroDeFracoes * convite.propriedade.diariasPorFracao;

      // O novo membro recebe um saldo proporcional ao restante do ano.
      const saldoProRataNovoMembro = saldoAnualTransferido * proporcaoAnoRestante;

      // 2.4. Transferência de Frações e Recálculo de Saldos
      // O master tem seu saldo atual debitado pelo valor anual total das frações cedidas.
      await tx.usuariosPropriedades.update({
        where: { id: masterLink.id },
        data: { 
            numeroDeFracoes: { decrement: convite.numeroDeFracoes },
            saldoDiariasAtual: { decrement: saldoAnualTransferido },
        },
      });

      // 2.5. Criação do Vínculo do Novo Membro com o Saldo Pro-Rata
      await tx.usuariosPropriedades.create({
        data: {
          idUsuario: idUsuarioLogado, idPropriedade: convite.idPropriedade,
          permissao: convite.permissao, numeroDeFracoes: convite.numeroDeFracoes,
          saldoDiariasAtual: saldoProRataNovoMembro,
        },
      });

      // 2.6. Finalização do Convite
      await tx.convite.update({
        where: { id: convite.id },
        data: { status: 'ACEITO', aceitoEm: new Date() },
      });

      // Retorna os dados para a notificação.
      return { idPropriedade: convite.idPropriedade };
    });

    // --- 3. Disparo da Notificação (Fire-and-Forget) ---
    createNotification({
      idPropriedade: notificationPayload.idPropriedade,
      idAutor: idUsuarioLogado,
      mensagem: `O usuário '${nomeNovoMembro}' aceitou o convite e agora é um membro da propriedade.`,
    }).catch((err) => {
      logEvents(`Falha ao criar notificação pós-aceite de convite: ${err.message}`, LOG_FILE);
    });
    
    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Convite aceito com sucesso! A propriedade agora faz parte da sua conta.',
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const { token } = req.params;
      prisma.convite.updateMany({ where: { token }, data: { status: 'ACEITO' } });
      return res.status(409).json({
        success: false,
        message: 'Você já é um membro desta propriedade.',
      });
    }
    if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    logEvents(`ERRO inesperado ao aceitar convite: ${error}\n`, LOG_FILE);
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao processar o convite.',
    });
  }
};