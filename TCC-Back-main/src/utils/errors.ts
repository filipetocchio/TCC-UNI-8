// Todos direitos autorais reservados pelo QOTA.

/**
 * Classe base para erros operacionais da aplicação.
 * Erros operacionais são erros esperados (ex: item não encontrado, dados inválidos),
 * em oposição a erros de programação.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // Garante que o stack trace seja capturado corretamente.
    Error.captureStackTrace(this, this.constructor);
  }
}

// Erro para quando um recurso não é encontrado (HTTP 404)
export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(message, 404);
  }
}

// Erro para dados de requisição inválidos (HTTP 400)
export class BadRequestError extends AppError {
  constructor(message = 'Requisição inválida.') {
    super(message, 400);
  }
}

// Erro para falhas de permissão (HTTP 403)
export class PermissionError extends AppError {
  constructor(message = 'Você não tem permissão para executar esta ação.') {
    super(message, 403);
  }
}

// Erro para falhas de autenticação (HTTP 401)
export class AuthenticationError extends AppError {
  constructor(message = 'Não autenticado.') {
    super(message, 401);
  }
}