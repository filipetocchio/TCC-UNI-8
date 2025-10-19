// Todos direitos autorais reservados pelo QOTA.

/**
 * Suite de Testes para os Endpoints de Autenticação
 *
 * Descrição:
 * Este arquivo contém os testes de integração para as rotas de autenticação
 * da API. O objetivo é garantir que os processos de registro, login, logout e
 * renovação de token funcionem conforme o esperado, cobrindo cenários de
 * sucesso, falha e segurança.
 */
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';
import jwt from 'jsonwebtoken';
import { protect } from '../middleware/authMiddleware';

// --- Mocks das Dependências ---
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn((plain, hashed) => Promise.resolve(plain === 'Password123!' && hashed.startsWith('hashed'))),
}));

jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

jest.mock('../middleware/authMiddleware', () => ({
  protect: jest.fn((req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, email: 'test@qota.com', nomeCompleto: 'Usuário de Teste' };
    next();
  }),
}));
const mockedProtect = protect as jest.Mock;

// --- Configuração da Aplicação de Teste ---
const app = express();
app.use(express.json());
app.use(cookieParser());
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

// --- Suite Principal de Testes de Autenticação ---
describe('Endpoints de Autenticação (/api/v1/auth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Testes para o endpoint de Registro de novos usuários.
  describe('POST /register', () => {
    it('Deve registrar um novo usuário com sucesso', async () => {
      // Arrange
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(mockFullUser as any);
      prismaMock.user.update.mockResolvedValue(mockFullUser as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('mocked-access-token');

      // Act
      const response = await request(app).post('/api/v1/auth/register').send(testUserPayload);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('Deve retornar 400 para dados de registro inválidos (CPF incorreto)', async () => {
        // Act
        const response = await request(app).post('/api/v1/auth/register').send({ ...testUserPayload, cpf: '123' });

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('O CPF deve ter exatamente 11 dígitos.');
    });

    it('Deve retornar 409 para um e-mail duplicado', async () => {
        // Arrange
        prismaMock.user.findFirst.mockResolvedValue(mockFullUser as any);

        // Act
        const response = await request(app).post('/api/v1/auth/register').send(testUserPayload);

        // Assert
        expect(response.status).toBe(409);
        expect(response.body.message).toContain('Este e-mail já está em uso');
    });
  });

  // Testes para o endpoint de Login de usuários existentes.
  describe('POST /login', () => {
    it('Deve autenticar um usuário com credenciais corretas', async () => {
      // Arrange
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser as any);
      prismaMock.user.update.mockResolvedValue(mockFullUser as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('mocked-access-token');

      // Act
      const response = await request(app).post('/api/v1/auth/login').send({
        email: testUserPayload.email,
        password: testUserPayload.password,
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('Deve retornar 401 para um usuário desativado (soft-deleted)', async () => {
        // Arrange: A query do controller busca por `excludedAt: null`. Se o usuário
        // está desativado, a busca no banco de dados real retornaria `null`.
        // O mock deve simular este comportamento.
        prismaMock.user.findFirst.mockResolvedValue(null);

        // Act
        const response = await request(app).post('/api/v1/auth/login').send({
            email: testUserPayload.email,
            password: testUserPayload.password,
        });

        // Assert
        expect(response.status).toBe(401);
        expect(response.body.message).toBe('E-mail ou senha inválidos.');
    });
  });

  // Testes para o endpoint de Renovação de Token.
  describe('POST /refresh', () => {
    it('Deve renovar o access token com sucesso', async () => {
      // Arrange
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser as any);
      (mockedJwt.verify as jest.Mock).mockReturnValue({ userId: mockFullUser.id, email: mockFullUser.email });
      (mockedJwt.sign as jest.Mock).mockReturnValue('new-mocked-access-token');

      // Act
      const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', `jwt=${mockFullUser.refreshToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
    });
  });

  // Testes para o endpoint de Logout de usuários.
  describe('POST /logout', () => {
    it('Deve realizar o logout com sucesso para um usuário autenticado', async () => {
      // Arrange
      mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = { id: mockFullUser.id, email: mockFullUser.email, nomeCompleto: mockFullUser.nomeCompleto };
        next();
      });
      prismaMock.user.findFirst.mockResolvedValue(mockFullUser as any);
      prismaMock.user.update.mockResolvedValue({ ...mockFullUser, refreshToken: null } as any);

      // Act
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `jwt=${mockFullUser.refreshToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout realizado com sucesso.');
    });

    it('Deve retornar 401 se a rota de logout for chamada sem autenticação', async () => {
      // Arrange
      mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        return res.status(401).json({ success: false, message: "Acesso não autorizado." });
      });

      // Act
      const response = await request(app).post('/api/v1/auth/logout');

      // Assert
      expect(response.status).toBe(401);
    });
  });
});