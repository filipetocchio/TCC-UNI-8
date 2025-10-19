// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Logout de Usuário
 *
 * Descrição:
 * Este arquivo contém a lógica para encerrar a sessão de um usuário de forma segura.
 * O processo de logout é realizado em duas frentes para máxima segurança:
 *
 * 1. Server-Side: O Refresh Token do usuário é removido do banco de dados. Isso
 * invalida o token, garantindo que ele não possa ser usado para gerar novos
 * Access Tokens, efetivamente desconectando a sessão em um nível fundamental.
 *
 * 2. Client-Side: O cookie 'jwt' que armazena o Refresh Token é removido do
 * navegador do usuário, completando o processo de logout.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'auth.log';

/**
 * Processa a solicitação de logout de um usuário autenticado.
 */
export const logoutAuth = async (req: Request, res: Response) => {
  try {
    // --- 1. Extração do Refresh Token do Cookie ---
    // Busca pelo cookie 'jwt' que armazena o refresh token na requisição.
    const cookies = req.cookies;
    if (!cookies?.jwt) {
      // Se não houver cookie, o usuário já está efetivamente deslogado.
      // A operação é idempotente; retorna sucesso pois o estado final desejado já foi alcançado.
      return res.status(200).json({
        success: true,
        message: 'Nenhum usuário para deslogar.',
      });
    }
    const refreshToken = cookies.jwt;

    // --- 2. Invalidação do Token no Banco de Dados ---
    // Procura por um usuário que possua o refresh token fornecido.
    const userFound = await prisma.user.findFirst({
      where: { refreshToken },
    });

    // Se um usuário for encontrado com este token, remove o token do seu registro.
    // Isso impede que o token seja reutilizado, mesmo que tenha sido capturado.
    if (userFound) {
      await prisma.user.update({
        where: { id: userFound.id },
        data: { refreshToken: null }, // Invalida o token no lado do servidor.
      });
    }

    // --- 3. Limpeza do Cookie no Navegador do Cliente ---
    // Instrui o navegador a remover o cookie 'jwt'. 
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Logout realizado com sucesso.',
    });
  } catch (error) {
    // Registra qualquer erro inesperado para fins de monitoramento.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO no processo de logout: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor durante o logout.',
    });
  }
};