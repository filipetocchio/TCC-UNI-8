// Todos direitos autorais reservados pelo QOTA.

import { CorsOptions } from "cors";
import { allowedOrigins } from "./allowedOrigins";
import { logEvents } from "../middleware/logEvents";

/**
 * Configuração centralizada para o middleware de CORS (Cross-Origin Resource Sharing).
 * Define quais origens são permitidas e como lidar com requisições que incluem credenciais.
 */
const corsOptions: CorsOptions = {
  /**
   * Valida a origem da requisição contra uma lista de permissões.
   * Se a origem estiver na lista (ou se a requisição não tiver origem, como no Postman),
   * o acesso é permitido.
   */
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin as string) !== -1 || !origin) {
      callback(null, true);
    } else {
      const errorMsg = `Origem não permitida pelo CORS: ${origin}`;
      logEvents(errorMsg, "corsErrors.txt");
      callback(new Error(errorMsg));
    }
  },
  
  /**
   * Habilita o suporte a credenciais (cookies, cabeçalhos de autorização)
   * em requisições cross-origin. Quando o frontend envia 'withCredentials: true',
   * o backend DEVE responder com 'Access-Control-Allow-Credentials: true',
   * e esta opção faz isso automaticamente. É essencial para o funcionamento
   * do sistema de refresh token baseado em cookies httpOnly.
   */
  credentials: true,

  /**
   * Define o status de sucesso para requisições de preflight (OPTIONS),
   * o que é necessário para alguns navegadores mais antigos.
   */
  optionsSuccessStatus: 200,
};

export { corsOptions };