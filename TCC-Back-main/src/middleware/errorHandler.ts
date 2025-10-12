// Todos direitos autorais reservados pelo QOTA.

import { Request, Response, NextFunction } from 'express';
import { z, ZodIssue } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from './logEvents';

/**
 * Middleware centralizado para tratamento de erros.
 * Captura erros lançados na aplicação, os categoriza e envia uma resposta HTTP padronizada.
 */
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Loga o erro no console do servidor para fins de depuração.
  // Utiliza console.error por ser um método robusto e universal.
  console.error(`[ERROR HANDLER] ${err.name}: ${err.message}\n${err.stack}`);

  // Trata erros operacionais customizados da aplicação (AppError e seus filhos).
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Trata erros de validação da biblioteca Zod.
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação nos dados enviados.',
      // Mapeia os 'issues' do Zod para um formato de erro mais limpo para o frontend.
      errors: err.issues.map((e: ZodIssue) => ({ path: e.path, message: e.message })),
    });
  }
  
  // Trata erros conhecidos do Prisma Client (ex: violação de constraint de unicidade).
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ // 409 Conflict
        success: false,
        message: `Conflito: Já existe um registro com os dados fornecidos.`,
      });
    }
  }

  // Fallback para todos os outros erros inesperados (erros 500).
  return res.status(500).json({
    success: false,
    message: 'Ocorreu um erro interno inesperado no servidor.',
  });
};