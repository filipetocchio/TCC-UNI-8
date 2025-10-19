// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Busca de Usuário por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint seguro que recupera os dados de um
 * usuário específico com base no seu ID.
 *
 * O processo é seguro e garante que:
 * 1.  Apenas usuários autenticados possam acessar o endpoint.
 * 2.  Um usuário só pode visualizar os seus próprios dados, garantindo a privacidade.
 *
 * A resposta inclui a URL completa da foto de perfil para fácil consumo pelo cliente.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'userAccess.log';

// Schema para validar o ID do usuário recebido via parâmetros da URL.
const getUserByIdSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'O ID do usuário fornecido é inválido.',
    }),
});

/**
 * Processa a requisição para buscar um usuário específico pelo seu ID.
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: requesterId } = req.user;
    const { id: targetUserId } = getUserByIdSchema.parse(req.params);

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que um usuário só pode acessar seus próprios dados.
    if (requesterId !== targetUserId) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode visualizar seu próprio perfil.' });
    }

    // --- 3. Busca do Usuário no Banco de Dados ---
    // Utiliza 'findUnique' para uma busca otimizada pelo ID.
    // O 'select' garante que apenas dados não sensíveis sejam recuperados.
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        telefone: true,
        dataCadastro: true,
        userPhoto: { select: { url: true } },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado.',
      });
    }

    // --- 4. Construção da URL Completa da Foto ---
    // Se o usuário possuir uma foto, o caminho relativo é combinado com o
    // domínio do servidor para formar uma URL absoluta.
    if (user.userPhoto?.url) {
      const domain = `${req.protocol}://${req.get('host')}`;
      user.userPhoto.url = `${domain}${user.userPhoto.url}`;
    }

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Usuário recuperado com sucesso.',
      data: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    // Registra qualquer erro inesperado para fins de monitoramento.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar usuário por ID: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar o usuário.',
    });
  }
};