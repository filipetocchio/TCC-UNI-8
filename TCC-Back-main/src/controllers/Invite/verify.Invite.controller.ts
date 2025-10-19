// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Verificação de Token de Convite
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint público que verifica a validade de
 * um token de convite. Este endpoint é o primeiro passo no fluxo de aceitação,
 * fornecendo ao frontend as informações necessárias para apresentar uma tela
 * contextualizada ao usuário.
 *
 * O processo envolve:
 * 1.  Validar o formato do token.
 * 2.  Verificar se o convite existe, está pendente e não expirou.
 * 3.  Caso o convite tenha expirado no momento da verificação, seu status é
 * atualizado para "EXPIRADO" no banco de dados.
 * 4.  Retornar os dados públicos e relevantes do convite, incluindo o número de frações.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'invite.log';

// Schema para validar se o token foi fornecido na rota e não está vazio.
const verifyInviteSchema = z.object({
  token: z.string().min(1, { message: 'O token do convite é obrigatório.' }),
});

/**
 * Processa a verificação de um token de convite.
 */
export const verifyInvite = async (req: Request, res: Response) => {
  try {
    // --- 1. Validação do Token de Convite ---
    const { token } = verifyInviteSchema.parse(req.params);

    // --- 2. Busca do Convite no Banco de Dados ---
    // Busca o convite pelo token, incluindo dados do convidante e da propriedade.
    const convite = await prisma.convite.findUnique({
      where: { token },
      select: {
        status: true,
        dataExpiracao: true,
        emailConvidado: true,
        usuarioJaExiste: true,
        numeroDeFracoes: true,
        propriedade: { select: { nomePropriedade: true } },
        convidadoPor: { select: { nomeCompleto: true } },
      },
    });

    // --- 3. Validação do Status e Validade do Convite ---
    // Se o convite não existe ou já foi utilizado, é considerado inválido.
    if (!convite || convite.status !== 'PENDENTE') {
      return res
        .status(404)
        .json({ success: false, message: 'Convite inválido ou já utilizado.' });
    }

    // Se o convite expirou, atualiza seu status para 'EXPIRADO' e retorna 410 (Gone).
    if (new Date() > convite.dataExpiracao) {
      await prisma.convite.update({
        where: { token },
        data: { status: 'EXPIRADO' },
      });
      return res
        .status(410)
        .json({ success: false, message: 'Este convite expirou.' });
    }

    // --- 4. Envio da Resposta com os Dados do Convite ---
    // Se o convite for válido, retorna os dados necessários para o frontend.
    return res.status(200).json({
      success: true,
      message: 'Convite válido.',
      data: {
        propriedade: convite.propriedade.nomePropriedade,
        convidadoPor: convite.convidadoPor.nomeCompleto,
        emailConvidado: convite.emailConvidado,
        userExists: convite.usuarioJaExiste,
        numeroDeFracoes: convite.numeroDeFracoes,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao verificar convite: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao verificar o convite.',
    });
  }
};