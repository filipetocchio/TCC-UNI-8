// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Renovação de Token de Acesso (Refresh Token)
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que renova a sessão de um usuário.
 * Ele utiliza um Refresh Token, enviado através de um cookie seguro (httpOnly),
 * para validar a identidade do usuário e emitir um novo Access Token de curta duração.
 *
 * Este mecanismo permite que os usuários permaneçam logados por longos períodos
 * de forma segura, sem a necessidade de expor o Access Token por muito tempo,
 * minimizando os riscos em caso de comprometimento.
 */
import { prisma } from '../../utils/prisma';
import jwt, { JwtPayload, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Request, Response } from 'express';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'auth.log';

// Define a estrutura esperada do payload dentro de um refresh token decodificado.
interface RefreshTokenPayload extends JwtPayload {
  userId: number;
  email: string;
}

// Constante para a duração do Access Token, mantendo consistência com o endpoint de login.
const ACCESS_TOKEN_EXPIRATION = '6h';

/**
 * Processa a renovação do token de acesso de um usuário.
 */
export const refreshTokenAuth = async (req: Request, res: Response) => {
  try {
    // --- 1. Extração e Validação Inicial do Refresh Token ---
    const refreshToken = req.cookies?.jwt;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. A sessão é inválida ou expirou.',
      });
    }

    // --- 2. Verificação do Token no Banco de Dados ---
    // Procura por um usuário ativo que possua o refresh token informado.
    // Esta etapa é crucial para garantir que o token não foi invalidado (ex: por um logout).
    const user = await prisma.user.findFirst({
      where: { refreshToken },
      include: {
        userPhoto: true, // Inclui a foto para manter o estado do frontend atualizado.
      },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Acesso proibido. O token de sessão não é mais válido.',
      });
    }

    // --- 3. Verificação da Assinatura e do Payload do Token ---
    // Decodifica o token para verificar sua assinatura e se ele pertence ao usuário encontrado.
    const decodedPayload = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as RefreshTokenPayload;

    // Garante que o ID do usuário no payload do token corresponde ao ID do usuário do banco.
    if (user.id !== decodedPayload.userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso proibido. Inconsistência na validação do token.',
      });
    }

    // --- 4. Geração de um Novo Access Token ---
    // Com a identidade do usuário confirmada, um novo Access Token é gerado.
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: ACCESS_TOKEN_EXPIRATION }
    );

    // --- 5. Envio da Resposta com o Novo Token e Dados do Usuário ---
    return res.status(200).json({
      success: true,
      message: 'Sessão restaurada com sucesso.',
      data: {
        accessToken,
        id: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
        cpf: user.cpf,
        telefone: user.telefone,
        userPhoto: user.userPhoto
          ? { url: `${req.protocol}://${req.get('host')}${user.userPhoto.url}` }
          : null,
      },
    });
  } catch (error) {
    // Trata erros de verificação do JWT (assinatura inválida, token expirado).
    if (error instanceof JsonWebTokenError || error instanceof TokenExpiredError) {
      return res.status(403).json({
        success: false,
        message: 'Acesso proibido. O token fornecido é inválido ou expirou.',
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao renovar token: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);

    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao tentar renovar a sessão.',
    });
  }
};