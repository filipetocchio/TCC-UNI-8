// Todos direitos autorais reservados pelo QOTA.

/**
 * Objeto de Configuração para o Middleware de CORS
 *
 * Descrição:
 * Este arquivo centraliza a configuração do CORS (Cross-Origin Resource Sharing)
 * para a aplicação. Ele define as regras que o servidor usará para determinar
 * se uma requisição vinda de uma origem diferente é segura e deve ser permitida.
 *
 * A configuração utiliza a lista de origens permitidas (allowedOrigins) para validar
 * cada requisição, garantindo que apenas os frontends autorizados possam interagir
 * com a API.
 */
import { CorsOptions } from 'cors';
import { allowedOrigins } from './allowedOrigins';
import { logEvents } from '../middleware/logEvents';

const corsOptions: CorsOptions = {
  /**
   * Função de validação de origem.
   * É executada para cada requisição recebida pelo servidor.
   */
  origin: (origin, callback) => {
    // Permite a requisição sob duas condições:
    // 1. A origem da requisição está na nossa lista de permissões (`allowedOrigins`).
    // 2. A requisição não possui uma origem definida (ex: requisições de servidor para servidor ou ferramentas como Postman).
    if (allowedOrigins.includes(origin as string) || !origin) {
      // Se a origem for válida, permite a continuação da requisição.
      callback(null, true);
    } else {
      // Se a origem for inválida, registra o evento para fins de segurança e auditoria.
      const errorMsg = `Origem não permitida pelo CORS: ${origin}`;
      logEvents(errorMsg, 'corsErrors.txt');

      // Rejeita a requisição com um erro.
      callback(new Error(errorMsg));
    }
  },

  // Habilita o recebimento de credenciais (como cookies ou tokens de autorização)
  // em requisições de origem cruzada. Essencial para o sistema de autenticação
  // que utiliza cookies httpOnly para gerenciar refresh tokens.
  credentials: true,

  // Define o código de status HTTP para requisições de preflight (OPTIONS).
  // O valor 200 (em vez do padrão 204) garante maior compatibilidade com
  // navegadores mais antigos ou clientes HTTP específicos.
  optionsSuccessStatus: 200,
};

export { corsOptions };