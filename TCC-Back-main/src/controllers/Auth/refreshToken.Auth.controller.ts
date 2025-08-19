import { prisma } from '../../utils/prisma';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const refreshTokenAuth = async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies?.accessToken || req.cookies?.jwt;

    if (!accessToken) {
      return res.status(401).json({
        code: 401,
        success: false,
        error: 'Token de acesso não encontrado nos cookies.',
      });
    }

    const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!) as {
      userId: string | number;
      email: string;
    };

    const user = await prisma.user.findUnique({
      where: { 
        id: typeof decodedToken.userId === 'string' 
            ? Number(decodedToken.userId) 
            : decodedToken.userId 
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        refreshToken: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        code: 401,
        success: false,
        error: 'Usuário não encontrado no banco de dados.',
      });
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: '60m' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: '7d' }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      code: 200,
      success: true,
      data: {
        id: user.id,
        email: user.email,
        nomeCompleto: user.nomeCompleto,
      },
    });
  } catch (error) {
    console.error('Erro ao renovar token:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        code: 401,
        success: false,
        error: 'Token inválido ou expirado. Faça login novamente.',
      });
    }

    return res.status(500).json({
      code: 500,
      success: false,
      error: 'Erro interno no servidor.',
    });
  }
};

export { refreshTokenAuth };