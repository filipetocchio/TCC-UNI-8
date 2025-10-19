// Todos direitos autorais reservados pelo QOTA.

/**
 * Middleware Centralizado para Tratamento de Erros
 *
 * Descrição:
 * Este arquivo contém o middleware `errorHandler`, que atua como um "catch-all"
 * no final da cadeia de processamento de requisições do Express. Sua função é
 * interceptar quaisquer erros que ocorram na aplicação, sejam eles exceções
 * inesperadas ou erros lançados intencionalmente.
 *
 * O middleware classifica o erro, registra-o para fins de monitoramento e envia
 * uma resposta JSON padronizada e segura para o cliente, evitando o vazamento de
 * detalhes sensíveis da implementação em ambiente de produção.
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodIssue } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logEvents } from './logEvents';

/**
 * Captura, loga e formata todos os erros da aplicação.
 * @param err O objeto de erro capturado.
 * @param req O objeto de requisição do Express.
 * @param res O objeto de resposta do Express.
 * @param next A função `next` do Express (obrigatória na assinatura de um error handler).
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // O parâmetro 'next' é necessário para que o Express reconheça esta função
  // como um middleware de tratamento de erros, mesmo que não seja utilizado.
  next: NextFunction
) => {
  // --- Log do Erro ---
  // Registra os detalhes do erro em um arquivo de log centralizado.
  const logMessage = `${err.name}: ${err.message}\t${req.method}\t${req.url}\t${req.headers.origin}\n${err.stack}`;
  logEvents(logMessage, 'errLog.txt');

  // --- Tratamento para Erros da Aplicação (AppError) ---
  // Erros operacionais conhecidos e lançados intencionalmente pela aplicação.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // --- Tratamento para Erros de Validação (Zod) ---
  // Erros gerados pela biblioteca Zod quando os dados de entrada são inválidos.
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação nos dados enviados.',
      errors: err.issues.map((e: ZodIssue) => ({
        path: e.path,
        message: e.message,
      })),
    });
  }

  // --- Tratamento para Erros do Prisma ---
  // Erros específicos do Prisma Client, como falhas de constraints do banco.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ // 409 Conflict
        success: false,
        message: 'Conflito: Já existe um registro com os dados fornecidos.',
      });
    }
  }

  // --- Fallback para Erros Inesperados (500) ---
  // Para todos os outros erros não categorizados, retorna uma mensagem genérica.
  return res.status(500).json({
    success: false,
    message: 'Ocorreu um erro interno inesperado no servidor.',
  });
};