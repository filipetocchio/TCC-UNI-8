// Todos direitos autorais reservados pelo QOTA.

/**
 * Middleware de Credenciais para CORS
 *
 * Descrição:
 * Este arquivo contém o middleware `credentials`, uma peça fundamental para a
 * configuração de CORS (Cross-Origin Resource Sharing) da aplicação.
 *
 * Sua responsabilidade é verificar se a origem de uma requisição está na lista
 * de origens permitidas (`allowedOrigins`) e, em caso afirmativo, adicionar o
 * cabeçalho `Access-Control-Allow-Credentials: true` à resposta.
 *
 * Este cabeçalho é essencial para permitir que os navegadores enviem e recebam
 * credenciais (como cookies e cabeçalhos de autorização) em requisições
 * cross-origin, o que é vital para o funcionamento do sistema de autenticação.
 *
 */
import { Request, Response, NextFunction } from 'express';
import { allowedOrigins } from '../config/allowedOrigins';

/**
 * Adiciona o cabeçalho 'Access-Control-Allow-Credentials' se a origem da
 * requisição for permitida.
 */
export const credentials = (req: Request, res: Response, next: NextFunction) => {
  // --- 1. Extração da Origem da Requisição ---
  const origin = req.headers.origin;

  // --- 2. Adição Condicional do Cabeçalho ---
  // Verifica se a origem existe e se está presente na nossa lista de permissões.
  if (origin && allowedOrigins.includes(origin)) {
    // Se a origem for confiável, informa ao navegador que ele pode
    // processar a resposta mesmo que a requisição inclua credenciais.
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  // --- 3. Passagem para o Próximo Middleware ---
  // Continua para o próximo middleware na cadeia (geralmente o middleware de cors).
  next();
};