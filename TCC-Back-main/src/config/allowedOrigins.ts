// Todos direitos autorais reservados pelo QOTA.

/**
 * Configuração da Lista de Origens Permitidas (CORS)
 *
 * Descrição:
 * Este módulo é responsável por definir a lista de URLs que têm permissão para
 * acessar a API, uma medida de segurança fundamental conhecida como CORS
 * (Cross-Origin Resource Sharing).
 *
 * A lógica prioriza a variável de ambiente `ALLOWED_ORIGINS`, que permite
 * configurar as origens de forma flexível em diferentes ambientes (produção, staging, etc.).
 * Se essa variável não for definida, o sistema gera uma lista padrão, ideal para o
 * ambiente de desenvolvimento local, incluindo as URLs do frontend e do próprio backend.
 *
 * Todas as URLs são validadas para garantir que possuem um formato correto, e a
 * lista final é depurada para remover quaisquer entradas duplicadas, resultando em
 * uma configuração de CORS limpa e segura.
 */
export const allowedOrigins: string[] = (() => {
  // Determina o protocolo a ser usado (https para produção, http para desenvolvimento).
  const isProduction = process.env.NODE_ENV === 'production';
  const protocol = isProduction ? 'https' : 'http';

  // Define valores padrão para a porta do backend e a URL do frontend.
  const port = process.env.PORT || '8001';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Garante que a URL do frontend contenha o protocolo correto.
  const formattedFrontendUrl = frontendUrl.startsWith('http')
    ? frontendUrl
    : `${protocol}://${frontendUrl}`;

  // Monta a lista de origens padrão para o ambiente de desenvolvimento.
  const defaultOrigins = [`${protocol}://localhost:${port}`, formattedFrontendUrl];

  // Verifica se uma lista de origens foi explicitamente definida na variável de ambiente.
  // Se sim, utiliza essa lista; caso contrário, recorre à lista padrão.
  const origins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : defaultOrigins;

  // Processa a lista final para remover duplicatas e filtrar apenas URLs válidas.
  const uniqueAndValidOrigins = [...new Set(origins)].filter((origin) => {
    try {
      // Tenta criar um objeto URL. Se a string for inválida, um erro será lançado.
      new URL(origin);
      return true; // A origem é uma URL válida.
    } catch {
      // Alerta o desenvolvedor sobre uma configuração incorreta no console.
      console.warn(`[CORS Config] A origem "${origin}" é inválida e será ignorada.`);
      return false; // A origem é inválida e será removida da lista.
    }
  });

  // Exibe a configuração final no console para fins de depuração e verificação.
  console.log('[CORS Config] Origens permitidas para requisições:', uniqueAndValidOrigins);

  return uniqueAndValidOrigins;
})();