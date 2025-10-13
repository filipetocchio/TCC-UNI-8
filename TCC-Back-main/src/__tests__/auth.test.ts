// Todos direitos autorais reservados pelo QOTA.

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser'; // Adicionado para parsear cookies nas requisições
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';

// Mock das dependências para isolar os testes dos comportamentos reais das bibliotecas.
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn((plain, hashed) => Promise.resolve(plain === 'Password123!' && hashed.startsWith('hashed'))),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn((payload, secret, options) => `mocked-jwt-token-for-${payload.userId}`),
  verify: jest.fn(),
}));

// Configuração da aplicação Express para o ambiente de teste.
const app = express();
app.use(express.json());
app.use(cookieParser()); // Habilita o parser de cookies
app.use('/api/v1', apiV1Router);

// --- Dados Mockados para os Testes ---

const testUserPayload = {
  email: `test-${Date.now()}@qota.com`,
  password: 'Password123!',
  nomeCompleto: 'Usuário de Teste',
  cpf: '12345678901',
  termosAceitos: true,
};

const mockFullUser = {
  id: 1,
  email: testUserPayload.email,
  password: `hashed-${testUserPayload.password}`, 
  refreshToken: 'valid-refresh-token',
  nomeCompleto: testUserPayload.nomeCompleto,
  telefone: null,
  cpf: testUserPayload.cpf,
  dataCadastro: new Date(),
  dataConsentimento: new Date(),
  versaoTermos: '1.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  excludedAt: null,
};


describe('Endpoints de Autenticação (/api/v1/auth)', () => {

  // Limpa todos os mocks antes de cada teste para garantir o isolamento.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Testes para o Endpoint de Registro ---
  describe('POST /register', () => {
    it('Deve registrar um novo usuário com sucesso e retornar um access token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(mockFullUser);
      prismaMock.user.update.mockResolvedValue(mockFullUser); // Mock para a atualização do refresh token

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUserPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('Deve impedir o registro com um e-mail duplicado', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUserPayload);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('Este e-mail já está em uso');
    });

    it('Deve retornar erro 400 para senhas com menos de 6 caracteres', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUserPayload, password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('A senha deve ter pelo menos 6 caracteres');
    });
  });

  // --- Testes para o Endpoint de Login ---
  describe('POST /login', () => {
    it('Deve autenticar um usuário com credenciais corretas e retornar um access token', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser);
      prismaMock.user.update.mockResolvedValue(mockFullUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserPayload.email, password: testUserPayload.password });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.headers['set-cookie']).toBeDefined(); // Verifica se o cookie 'jwt' foi setado
    });

    it('Deve rejeitar o login com uma senha incorreta usando uma mensagem genérica', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser);
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserPayload.email, password: 'wrongPassword' });

      expect(response.status).toBe(401);
      // Valida a mensagem de erro genérica para evitar enumeração de usuários.
      expect(response.body.message).toBe('E-mail ou senha inválidos.');
    });

    it('Deve rejeitar o login de um usuário não existente usando uma mensagem genérica', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@qota.com', password: 'anyPassword' });

      expect(response.status).toBe(401);
      // Valida a mesma mensagem genérica.
      expect(response.body.message).toBe('E-mail ou senha inválidos.');
    });
  });

  // --- Testes para o Endpoint de Refresh Token ---
  describe('POST /refresh', () => {
    it('Deve renovar o access token com sucesso ao fornecer um refresh token válido', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser);
      
      // Simula a verificação bem-sucedida do JWT
      (require('jsonwebtoken').verify as jest.Mock).mockImplementation((token, secret, callback) => {
        callback(null, { userId: mockFullUser.id, email: mockFullUser.email });
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `jwt=${mockFullUser.refreshToken}`); // Envia o cookie na requisição

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('Deve retornar 401 Unauthorized se nenhum refresh token for fornecido', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh'); // Sem cookie

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Acesso não autorizado');
    });

    it('Deve retornar 403 Forbidden se o refresh token for inválido ou não corresponder a um usuário', async () => {
      // Simula que o token fornecido não foi encontrado no banco de dados.
      prismaMock.user.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'jwt=invalid-or-revoked-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Acesso proibido. Token inválido');
    });
  });
});