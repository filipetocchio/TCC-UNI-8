// Todos direitos autorais reservados pelo QOTA.

/**
 * Módulo de Erros Customizados da Aplicação
 *
 * Descrição:
 * Este arquivo define um conjunto de classes de erro customizadas que são utilizadas
 * em toda a aplicação para representar "erros operacionais".
 *
 * Erros operacionais são erros esperados e previsíveis, como "recurso não
 * encontrado" ou "permissão negada", em contraste com erros de programação
 * inesperados.
 *
 * Utilizar estas classes permite que o nosso `errorHandler` centralizado identifique
 * o tipo de erro e envie uma resposta HTTP com o status e a mensagem apropriados,
 * tornando o tratamento de erros mais robusto, previsível e seguro.
 */

/**
 * Classe base para todos os erros operacionais da aplicação.
 */
export class AppError extends Error {
  // O código de status HTTP associado ao erro (ex: 404, 403).
  public readonly statusCode: number;
  // Flag para identificar este erro como operacional e seguro para expor a mensagem ao cliente.
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // Garante que a pilha de chamadas (stack trace) seja capturada corretamente,
    // omitindo o construtor da classe de erro da pilha.
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Representa um erro para quando um recurso solicitado não é encontrado.
 * Mapeia para o status HTTP 404 (Not Found).
 */
export class NotFoundError extends AppError {
  constructor(message = 'O recurso solicitado não foi encontrado.') {
    super(message, 404);
  }
}

/**
 * Representa um erro para dados de requisição inválidos ou mal formatados.
 * Mapeia para o status HTTP 400 (Bad Request).
 */
export class BadRequestError extends AppError {
  constructor(message = 'Os dados fornecidos na requisição são inválidos.') {
    super(message, 400);
  }
}

/**
 * Representa um erro de autorização, quando o usuário não tem permissão para a ação.
 * Mapeia para o status HTTP 403 (Forbidden).
 */
export class PermissionError extends AppError {
  constructor(message = 'Você não tem permissão para executar esta ação.') {
    super(message, 403);
  }
}

/**
 * Representa um erro de autenticação, quando o usuário não está logado.
 * Mapeia para o status HTTP 401 (Unauthorized).
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Acesso não autorizado. É necessário estar autenticado.') {
    super(message, 401);
  }
}