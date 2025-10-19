// Todos direitos autorais reservados pelo QOTA.

/**
 * Utilitário para Conversão de Moeda
 *
 * Descrição:
 * Este arquivo fornece uma função utilitária robusta para converter valores de
 * moeda, que podem estar em diversos formatos (número, string formatada em
 * português, string padrão), para um tipo numérico (float) de forma segura.
 *
 * A função é projetada para lidar com entradas nulas, indefinidas ou mal
 * formatadas, garantindo que o valor de retorno seja sempre um número válido
 * (padrão de 0 em caso de falha na conversão), evitando a propagação de `NaN`
 * (Not a Number) no sistema.
 */

/**
 * Converte um valor de moeda (número ou string) para um número (float).
 * Lida com formatos brasileiros (ex: "1.234,56") e padrão (ex: "1234.56").
 * @param value O valor a ser convertido.
 * @returns O valor numérico correspondente, ou 0 se a conversão falhar.
 */
export function parseCurrencyStringToFloat(
  value: string | number | null | undefined
): number {
  // --- 1. Tratamento de Casos Nulos ou Indefinidos ---
  if (value === null || value === undefined) {
    return 0;
  }

  // --- 2. Tratamento de Valores Já Numéricos ---
  // Se o valor já for um número, não há necessidade de conversão.
  if (typeof value === 'number') {
    return value;
  }

  // --- 3. Limpeza e Padronização da String ---
  const stringValue = String(value).trim();
  if (stringValue === '') {
    return 0;
  }

  // A abordagem mais segura:
  // a) Remove todos os pontos (separadores de milhar).
  // b) Substitui a vírgula (separador decimal brasileiro) por um ponto.
  const cleanValue = stringValue.replace(/\./g, '').replace(',', '.');

  // --- 4. Conversão e Validação Final ---
  // Converte a string limpa para um número de ponto flutuante.
  const numericValue = parseFloat(cleanValue);

  // Garante que a função nunca retorne NaN, o que poderia causar erros de cálculo.
  return isNaN(numericValue) ? 0 : numericValue;
}