/**
 * Converte um valor de moeda, que pode ser um número ou uma string em formato
 * brasileiro (ex: "1.234,56") ou padrão (ex: "1234.56"), para um número (float) de forma segura.
 * @param value O valor a ser convertido.
 * @returns O valor numérico correspondente.
 */
export function parseCurrencyStringToFloat(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  // Se o valor já for um número, simplesmente o retorna.
  if (typeof value === 'number') {
    return value;
  }

  const stringValue = String(value).trim();
  
  // Se a string estiver vazia, retorna 0.
  if (stringValue === '') {
    return 0;
  }
  
  // A abordagem mais segura: remove todos os caracteres não numéricos, exceto o último separador (vírgula ou ponto).
  // Primeiro, remove todos os pontos.
  let cleanValue = stringValue.replace(/\./g, '');
  // Em seguida, substitui a vírgula por um ponto.
  cleanValue = cleanValue.replace(',', '.');
  
  return parseFloat(cleanValue);
}