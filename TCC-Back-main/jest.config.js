// Todos direitos autorais reservados pelo QOTA.

/**
 * @file jest.config.js
 * @description Configuração centralizada e profissional para o Jest.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],

  // Aponta para o nosso único arquivo de setup, que agora contém tudo.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};