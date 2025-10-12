// Todos direitos autorais reservados pelo QOTA.

import { PrismaClient, Prisma } from '@prisma/client';

// Padrão Singleton para garantir uma única instância do Prisma Client na aplicação.
// Isso evita a criação de múltiplas conexões com o banco de dados.
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Função de guarda de tipo (type guard) para identificar erros conhecidos do Prisma.
 * Importa o tipo 'PrismaClientKnownRequestError' diretamente do cliente,
 * o que é a abordagem mais segura e robusta.
 * @param error - O erro a ser verificado.
 * @returns {boolean} - Verdadeiro se o erro for uma instância de PrismaClientKnownRequestError.
 */
export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}