/**
 * @file auth.test.ts
 * @description Suíte de testes de integração para os endpoints de autenticação (/api/v1/auth).
 * Garante que os fluxos de registro e login estejam funcionando conforme o esperado.
 */
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { apiV1Router } from '../routes/routes';

// --- Configuração do Ambiente de Teste ---

const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

const prisma = new PrismaClient();

// Dados de teste consistentes para serem usados em múltiplos testes.
const testUser = {
  email: `test-user-${Date.now()}@qota.com`, // Email único para cada execução de teste
  password: 'PasswordForTesting123!',
  nomeCompleto: 'Usuário de Teste Principal',
  cpf: Math.random().toString().slice(2, 13), // CPF aleatório para evitar duplicatas
  termosAceitos: true,
};

// --- Hooks do Jest para Setup e Teardown do Banco de Dados ---

/**
 * @description Hook que é executado UMA VEZ antes de todos os testes nesta suíte.
 * É responsável por registrar o usuário de teste através da API, garantindo
 * que a senha seja corretamente hasheada pelo controller de registro.
 * Este padrão é conhecido como "seeding" de dados de teste.
 */
beforeAll(async () => {
  await request(app).post('/api/v1/auth/register').send(testUser);
});

/**
 * @description Hook que é executado UMA VEZ após todos os testes nesta suíte.
 * É responsável por limpar os dados de teste criados, garantindo que o
 * banco de dados permaneça limpo (test isolation).
 */
afterAll(async () => {
  // Deleta o usuário de teste para não poluir o banco de dados
  await prisma.user.delete({ where: { email: testUser.email } });
  await prisma.$disconnect(); // Fecha a conexão com o banco
});

// --- Suíte de Testes ---

describe('Auth Endpoints', () => {
  
  it('should prevent registration with a duplicate email', async () => {
    // Tenta registrar um usuário com o mesmo email do usuário já criado no beforeAll
    const response = await request(app).post('/api/v1/auth/register').send(testUser);
    expect(response.status).toBe(409); // Conflict
    expect(response.body.message).toContain('e-mail já está em uso');
  });
  
  it('should allow a registered user to log in with correct credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password, // Envia a senha em texto plano, como um usuário faria
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('accessToken');
  });

  it('should reject login with incorrect credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'wrong_password',
      });

    expect(response.status).toBe(401); // Unauthorized
    expect(response.body.success).toBe(false);
  });
});

