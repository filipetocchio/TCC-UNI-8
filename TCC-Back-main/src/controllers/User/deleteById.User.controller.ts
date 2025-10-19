// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Encerramento de Conta de Usuário por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o encerramento de uma conta de usuário. O
 * processo é seguro, garantindo que um usuário só possa encerrar a própria conta,
 * e é projetado para conformidade com a privacidade de dados.
 *
 * A operação combina duas ações principais:
 * 1.  Soft Delete: O usuário é marcado como inativo no sistema (`excludedAt`).
 * 2.  Anonimização: Os dados pessoais e únicos do usuário (e-mail, CPF, nome) são
 * sobrescritos com valores anônimos para liberar as credenciais para futuros
 * cadastros, efetivando o "direito ao esquecimento".
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'user.log';

// Schema para validar o ID do usuário recebido via parâmetros da URL.
const deleteUserByIdSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'O ID do usuário fornecido é inválido.',
    }),
});

/**
 * Processa o encerramento e a anonimização da conta de um usuário.
 */
export const deleteUserById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: requesterId } = req.user;
    const { id: targetUserId } = deleteUserByIdSchema.parse(req.params);

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que um usuário só pode encerrar a própria conta.
  
    if (requesterId !== targetUserId) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode encerrar sua própria conta.' });
    }

    // --- 3. Busca do Usuário no Banco de Dados ---
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user || user.excludedAt) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado ou já foi encerrado.',
      });
    }

    // --- 4. Preparação dos Dados Anonimizados ---
    // Ofusca os campos únicos com um prefixo e um timestamp para garantir
    // que o novo valor permaneça único no banco de dados.
    const timestamp = Date.now();
    const anonymizedEmail = `deleted_${timestamp}_${user.email}`;
    const anonymizedCpf = `deleted_${timestamp}_${user.cpf}`;

    // --- 5. Execução da Atualização (Soft Delete e Anonimização) ---
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        excludedAt: new Date(),
        email: anonymizedEmail,
        cpf: anonymizedCpf,
        refreshToken: null, // Invalida qualquer sessão ativa.
        nomeCompleto: 'Usuário Removido',
        telefone: null,
      },
    });

    // --- 6. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'A sua conta de usuário foi encerrada com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao encerrar conta de usuário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao encerrar a conta.',
    });
  }
};