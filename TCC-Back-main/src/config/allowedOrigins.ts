/**
 * Lista de origens permitidas para CORS.
 * Configurada via ALLOWED_ORIGINS no .env ou usa valores padrão baseados em PORT e FRONTEND_URL.
 * Suporta HTTP em dev e HTTPS em produção.
 * @example "http://localhost:8001,http://localhost:3000" ou "https://api.meudominio.com,https://meudominio.com"
 */
export const allowedOrigins: string[] = (() => {
  const port = process.env.PORT || "8001";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const isProduction = process.env.NODE_ENV === "production";
  const protocol = isProduction ? "https" : "http";

  // Valores padrão ajustados para o protocolo
  const defaultOrigins = [
    `${protocol}://localhost:${port}`,
    frontendUrl.startsWith("http") ? frontendUrl : `${protocol}://${frontendUrl}`,
  ];

  // Usa ALLOWED_ORIGINS se definido, senão os padrões
  const origins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : defaultOrigins;

  // Remove duplicatas e valida URLs
  const uniqueOrigins = [...new Set(origins)].filter((origin) => {
    try {
      new URL(origin);
      return true;
    } catch {
      console.warn(`Origem inválida ignorada: ${origin}`);
      return false;
    }
  });

  return uniqueOrigins;
})();