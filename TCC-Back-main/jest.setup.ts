// Todos direitos autorais reservados pelo QOTA.

import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { prisma } from './src/utils/prisma';
import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';

/**
 * Simula a biblioteca 'bcrypt' para o ambiente de testes.
 * Esta abordagem otimiza a velocidade dos testes e permite controle total sobre os resultados.
 */
jest.mock('bcrypt');

// Realiza a asserção de tipo para informar ao TypeScript a assinatura correta das funções.
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

mockedBcrypt.hash.mockImplementation(
  (password: string | Buffer, salt: string | number): Promise<string> => {
    return Promise.resolve(`hashed-${password.toString()}`);
  }
);
mockedBcrypt.compare.mockImplementation(
  (password: string | Buffer, hash: string): Promise<boolean> => {
    return Promise.resolve(hash === `hashed-${password.toString()}`);
  }
);

/**
 * Simula o cliente Prisma para isolar os testes do banco de dados real.
 */
jest.mock('./src/utils/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

/**
 * Hook executado antes de cada teste para limpar os mocks anteriores,
 * garantindo a independência entre os testes.
 */
beforeEach(() => {
  mockReset(prismaMock);
});

/**
 * Exporta a instância mockada do Prisma para ser usada nos arquivos de teste.
 */
export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;