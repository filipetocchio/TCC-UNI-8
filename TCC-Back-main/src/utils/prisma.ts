/**
 * @file prisma.ts
 * @description Centraliza a inicialização e exportação do cliente Prisma.
 * Inclui funções utilitárias para o tratamento de erros específicos do Prisma.
 */

// Importa o cliente e os tipos gerados pelo Prisma
import { PrismaClient, Prisma } from '@prisma/client';

// Cria uma única instância global do PrismaClient (Singleton Pattern).
// Isso previne a criação de múltiplas conexões com o banco de dados.
export const prisma = new PrismaClient();

/**
 * @function isPrismaError
 * @description Type guard que verifica se um erro desconhecido é uma instância de um erro
 * conhecido do Prisma Client. Isso permite um tratamento de erros mais seguro e específico.
 * @param {unknown} error - O erro capturado em um bloco catch.
 * @returns {boolean} Retorna 'true' se o erro for do tipo PrismaClientKnownRequestError.
 */
export function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
