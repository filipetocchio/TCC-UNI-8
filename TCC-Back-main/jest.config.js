/**
 * @file jest.config.js
 * @description Configuração profissional para o Jest, otimizada para projetos em TypeScript.
 * Define o ambiente, o preset de compilação e onde encontrar os arquivos de teste.
 */
module.exports = {
  /**
   * Preset que configura o Jest para transpilar arquivos TypeScript usando ts-jest.
   */
  preset: 'ts-jest',

  /**
   * Define o ambiente de execução dos testes. 'node' é essencial para testes de back-end.
   */
  testEnvironment: 'node',

  /**
   * Padrão de glob que o Jest usará para detectar os arquivos de teste no projeto.
   * Procura por qualquer arquivo .ts dentro de uma pasta chamada __tests__.
   */
  testMatch: ['**/__tests__/**/*.test.ts'],
};