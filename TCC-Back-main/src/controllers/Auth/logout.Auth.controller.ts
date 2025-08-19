import { prisma } from '../../utils/prisma';
import { Request, Response, NextFunction } from 'express';

const logoutAuth = async (req: Request, res: Response) => {
  try {

    const cookies = req.cookies;

    if (!cookies?.jwt) {
      return res.status(200).json({
        success: true,
        message: 'Nenhum usuário está logado.',
        data: null,
        error: null,
      });
    }

    const refreshToken = cookies.jwt;

    const user = await prisma.user.findFirst({
      where: { refreshToken },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: '' },
      });
    }

    res.clearCookie('jwt', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Logout realizado com sucesso.',
      data: null,
      error: null,
    });
  } catch (error) {
    console.error('Erro no logout:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
      error: 'Erro interno do servidor.',
      data: null,
    });
  }
};

export const checkJwtCookie = (req: Request, res: Response, next: NextFunction) => {
  console.log('Cookies no middleware:', req.cookies);
  if (!req.cookies?.jwt) {
    console.log('No jwt cookie found');
  }
  next();
};

export { logoutAuth };