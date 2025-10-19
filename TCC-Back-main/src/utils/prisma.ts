// Todos direitos autorais reservados pelo QOTA.

/**
 * Módulo de Instanciação do Prisma Client
 *
 * Descrição:
 * Este arquivo é responsável pela inicialização e exportação da instância do
 * Prisma Client, que gerencia a conexão com o banco de dados.
 *
 * Ele implementa o padrão "Singleton" de forma segura para o ambiente Node.js,
 * garantindo que apenas uma instância do PrismaClient seja criada e reutilizada
 * em toda a aplicação. Isso é crucial para o desempenho e para evitar a
 * exaustão de conexões com o banco de dados, especialmente em ambientes de
 * desenvolvimento com recarregamento automático (hot-reloading).
 *
 * Além disso, a configuração de log é ajustada dinamicamente com base no ambiente,
 * sendo mais verbosa em desenvolvimento e mais restrita (apenas erros) em produção.
 */
import { PrismaClient, Prisma } from '@prisma/client';

// --- Instanciação do Prisma Client (Padrão Singleton) ---

// Define um tipo global para armazenar a instância do Prisma.
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// Define os níveis de log com base no ambiente da aplicação.
// Em produção, registramos apenas erros para otimizar a performance e a segurança.
// Em desenvolvimento, registramos tudo, incluindo as queries executadas.
const logLevels: Prisma.LogLevel[] =
  process.env.NODE_ENV === 'production'
    ? ['error']
    : ['query', 'info', 'warn', 'error'];

// Exporta a instância do Prisma. Se já existir uma instância global, ela é
// reutilizada; caso contrário, uma nova é criada.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
  });

// Em ambiente de não-produção, armazena a instância criada na variável global
// para que ela possa ser reutilizada nas próximas recargas do módulo.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// --- Funções Utilitárias ---

/**
 * Função de guarda de tipo (type guard) para identificar erros conhecidos do Prisma.
 * Permite um tratamento de erros mais seguro e específico nos blocos `catch`.
 * @param error O erro a ser verificado, de tipo 'unknown'.
 * @returns Verdadeiro se o erro for uma instância de PrismaClientKnownRequestError.
 */
export function isPrismaError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}