// Todos direitos autorais reservados pelo QOTA.

import request from 'supertest';
import express from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';

const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

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
  refreshToken: null,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('Deve registrar um novo usuário com sucesso', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(mockFullUser);

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
      expect(response.body.message).toContain('e-mail já está em uso');
    });

    it('Deve retornar erro 400 para senhas com menos de 6 caracteres', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...testUserPayload, password: '123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('A senha deve ter pelo menos 6 caracteres');
    });
  });

  describe('POST /login', () => {
    it('Deve permitir o login de um usuário com credenciais corretas', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserPayload.email, password: testUserPayload.password });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('Deve rejeitar o login com uma senha incorreta', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser);
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUserPayload.email, password: 'wrongPassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Senha incorreta');
    });

    it('Deve rejeitar o login de um usuário não existente', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@qota.com', password: 'anyPassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('E-mail não encontrado');
    });
  });
});