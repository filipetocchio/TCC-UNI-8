// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

interface RefreshTokenPayload {
  userId: number;
  email: string;
}

/**
 * Renova o token de acesso de um usuário a partir de um refresh token válido.
 * Este processo revalida a sessão do usuário e retorna um novo access token,
 * juntamente com os dados completos do perfil do usuário para sincronização do frontend.
 *
 * @param req - O objeto de requisição do Express, contendo o cookie 'jwt'.
 * @param res - O objeto de resposta do Express.
 */
export const refreshTokenAuth = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.jwt;
    if (!refreshToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'Acesso não autorizado. Sessão inválida.' 
      });
    }

    // Busca o usuário que possui o refresh token, incluindo os dados da foto de perfil.
    const user = await prisma.user.findFirst({
      where: { refreshToken },
      include: {
        userPhoto: true,
      },
    });

    if (!user) {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso proibido. Token inválido.' 
      });
    }

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string,
      (err: any, decoded: any) => {
        const decodedPayload = decoded as RefreshTokenPayload;

        if (err || user.id !== decodedPayload.userId) {
          return res.status(403).json({ 
            success: false, 
            message: 'Acesso proibido. Falha na verificação do token.' 
          });
        }
        
        const accessToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            nomeCompleto: user.nomeCompleto,
          },
          process.env.ACCESS_TOKEN_SECRET as string,
          { expiresIn: '6h' }
        );

        // Retorna o novo access token e o objeto completo do usuário, padronizado
        // com a resposta do endpoint de login para garantir consistência no frontend.
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
      }
    );
  } catch (error) {
    console.error('Falha ao renovar o token:', error);
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro interno no servidor.',
    });
  }
};