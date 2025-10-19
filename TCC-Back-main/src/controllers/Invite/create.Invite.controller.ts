// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Criação de Convites
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que permite a um "proprietario_master"
 * criar um convite para um novo usuário se juntar a uma propriedade.
 *
 * O processo é seguro e executa uma série de validações críticas:
 * 1.  Autorização: Garante que apenas um proprietário master da propriedade pode enviar convites.
 * 2.  Validade das Frações: Verifica se o master possui frações suficientes para ceder.
 * 3.  Integridade da Propriedade: Garante que o convite não fará com que o total de
 * frações distribuídas exceda o limite da propriedade.
 * 4.  Duplicidade: Impede o envio de um convite para um usuário que já é membro.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { logEvents } from '../../middleware/logEvents';
import { createNotification } from '../../utils/notification.service';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'invite.log';

// --- Constantes e Schemas de Validação ---
const INVITE_EXPIRATION_DAYS = 7;

const createInviteSchema = z.object({
  emailConvidado: z.string().email({ message: 'O formato do e-mail é inválido.' }),
  idPropriedade: z.number().int().positive(),
  permissao: z.enum(['proprietario_master', 'proprietario_comum']),
  numeroDeFracoes: z.number().int().min(0, 'O número de frações não pode ser negativo.'),
});

/**
 * Processa a criação de um novo convite para uma propriedade.
 */
export const createInvite = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: idConvidadoPor, nomeCompleto: nomeConvidante } = req.user;
    const { emailConvidado, idPropriedade, permissao, numeroDeFracoes } =
      createInviteSchema.parse(req.body);

    // --- 2. Verificação de Autorização e Frações (Segurança) ---
    const masterLink = await prisma.usuariosPropriedades.findFirst({
      where: { idUsuario: idConvidadoPor, idPropriedade, permissao: 'proprietario_master' },
      include: { propriedade: true },
    });

    if (!masterLink) {
      return res.status(403).json({ success: false, message: 'Acesso negado: Apenas proprietários master podem enviar convites.' });
    }
    if (masterLink.numeroDeFracoes < numeroDeFracoes) {
      return res.status(400).json({ success: false, message: `Você não pode ceder ${numeroDeFracoes} frações pois possui apenas ${masterLink.numeroDeFracoes}.` });
    }

    // --- 3. Verificação de Integridade da Propriedade (Segurança) ---
    const todosMembros = await prisma.usuariosPropriedades.findMany({ where: { idPropriedade } });
    const somaAtualFracoes = todosMembros.reduce((acc, membro) => acc + membro.numeroDeFracoes, 0);
    if (somaAtualFracoes + numeroDeFracoes > masterLink.propriedade.totalFracoes) {
        return res.status(400).json({ success: false, message: `Este convite excede o número total de frações da propriedade. Frações disponíveis: ${masterLink.propriedade.totalFracoes - somaAtualFracoes}` });
    }

    // --- 4. Verificação de Vínculo Existente ---
    const invitedUserExists = await prisma.user.findUnique({ where: { email: emailConvidado } });
    if (invitedUserExists) {
      const isAlreadyMember = await prisma.usuariosPropriedades.findFirst({
        where: { idUsuario: invitedUserExists.id, idPropriedade },
      });
      if (isAlreadyMember) {
        return res.status(409).json({ success: false, message: 'Este usuário já é membro da propriedade.' });
      }
    }

    // --- 5. Geração do Token e Definição da Validade ---
    const token = randomBytes(32).toString('hex');
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + INVITE_EXPIRATION_DAYS);

    // --- 6. Criação do Registro do Convite ---
    const convite = await prisma.convite.create({
      data: {
        token, emailConvidado, idPropriedade, idConvidadoPor,
        permissao, numeroDeFracoes, usuarioJaExiste: !!invitedUserExists, dataExpiracao,
      },
    });

    // --- 7. Disparo de Notificação (Desempenho) ---
    const linkConvite = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/convite/${convite.token}`;
    
    createNotification({
        idPropriedade,
        idAutor: idConvidadoPor,
        mensagem: `Um convite para se juntar à propriedade '${masterLink.propriedade.nomePropriedade}' foi enviado para ${emailConvidado} por '${nomeConvidante}'.`
    }).catch(err => logEvents(`Falha ao criar notificação para novo convite: ${err.message}`, LOG_FILE));
    
    // --- 8. Envio da Resposta de Sucesso ---
    return res.status(201).json({
      success: true,
      message: `Convite criado com sucesso para ${emailConvidado}.`,
      data: { linkConvite },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao criar convite: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao criar o convite.',
    });
  }
};