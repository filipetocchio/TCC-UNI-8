// Todos direitos autorais reservados pelo QOTA.

/**
 * Suite de Testes para os Endpoints de Convites
 *
 * Descrição:
 * Este arquivo contém os testes de integração para as rotas de gerenciamento de
 * convites. O objetivo é validar o comportamento de criação, verificação, aceite
 * e listagem, garantindo que as regras de negócio do novo fluxo de frações
 * e as validações de segurança sejam aplicadas corretamente.
 */
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';
import { protect } from '../middleware/authMiddleware';
import { createNotification } from '../utils/notification.service';
import { StatusConvite } from '@prisma/client';

// --- Mocks das Dependências ---
jest.mock('../middleware/authMiddleware', () => ({
  protect: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));
const mockedProtect = protect as jest.Mock;

jest.mock('../utils/notification.service');
const mockedCreateNotification = createNotification as jest.Mock;

// --- Configuração da Aplicação de Teste ---
const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

// --- Dados Mockados para os Testes ---
const masterUser = { id: 1, email: 'master@qota.com', nomeCompleto: 'Master da Silva' };
const commonUser = { id: 2, email: 'comum@qota.com', nomeCompleto: 'Comum de Souza' };
const newInvitedUser = { id: 3, email: 'novo.convidado@qota.com', nomeCompleto: 'Novo Convidado' };

const mockProperty = { id: 1, totalFracoes: 52, diariasPorFracao: 7.019, nomePropriedade: 'Casa de Praia' };

const mockMasterLink = {
  id: 101, idUsuario: masterUser.id, idPropriedade: 1,
  permissao: 'proprietario_master', numeroDeFracoes: 40,
  propriedade: mockProperty,
};

const mockValidInvite = {
  id: 1, token: 'valid-token', emailConvidado: newInvitedUser.email,
  idPropriedade: 1, idConvidadoPor: masterUser.id, permissao: 'proprietario_comum',
  numeroDeFracoes: 2, status: StatusConvite.PENDENTE,
  dataExpiracao: new Date(Date.now() + 86400000), propriedade: mockProperty,
};

// --- Suite Principal de Testes de Convites ---
describe('Endpoints de Convites (/api/v1/invite)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
      req.user = masterUser;
      next();
    });
    mockedCreateNotification.mockResolvedValue(undefined);
  });

  // Testes para o endpoint de criação de convites.
  describe('POST / (Criar Convite)', () => {
    it('Deve permitir que um master crie um convite com sucesso', async () => {
      // Arrange
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink as any);
      prismaMock.usuariosPropriedades.findMany.mockResolvedValue([mockMasterLink] as any);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.convite.create.mockResolvedValue(mockValidInvite as any);

      // Act
      const response = await request(app).post('/api/v1/invite').send({
        emailConvidado: 'novo@qota.com', idPropriedade: 1, permissao: 'proprietario_comum', numeroDeFracoes: 2,
      });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('linkConvite');
      expect(mockedCreateNotification).toHaveBeenCalled();
    });

    it('Deve impedir que um cotista comum crie um convite', async () => {
        // Arrange
        mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = commonUser;
            next();
        });
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(null);

        // Act
        const response = await request(app).post('/api/v1/invite').send({
            emailConvidado: 'outro@qota.com', idPropriedade: 1, permissao: 'proprietario_comum', numeroDeFracoes: 1,
        });
  
        // Assert
        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Acesso negado');
    });
  });

  // Testes para o endpoint de verificação de token.
  describe('GET /verify/:token', () => {
    it('Deve retornar os detalhes de um convite válido, incluindo o número de frações', async () => {
      // Arrange
      const mockInviteForVerify = { ...mockValidInvite, convidadoPor: { nomeCompleto: 'Master da Silva' } };
      prismaMock.convite.findUnique.mockResolvedValue(mockInviteForVerify as any);

      // Act
      const response = await request(app).get('/api/v1/invite/verify/valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.propriedade).toBe('Casa de Praia');
      expect(response.body.data.numeroDeFracoes).toBe(2);
    });
  });
  
  // Testes para o endpoint de aceitação de convite.
  describe('POST /accept/:token', () => {
    it('Deve permitir que um usuário aceite um convite válido', async () => {
      // Arrange
      mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = newInvitedUser;
        next();
      });

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          convite: { findFirst: jest.fn().mockResolvedValue(mockValidInvite), update: jest.fn() },
          usuariosPropriedades: { findFirst: jest.fn().mockResolvedValue(mockMasterLink), update: jest.fn(), create: jest.fn() },
        };
        return await callback(mockTx);
      });
      
      // Act
      const response = await request(app).post('/api/v1/invite/accept/valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Convite aceito com sucesso! A propriedade agora faz parte da sua conta.');
      expect(mockedCreateNotification).toHaveBeenCalled();
    });
  });

  // Testes para o endpoint de listagem de convites pendentes.
  describe('GET /property/:propertyId/pending', () => {
    it('Deve retornar uma lista de convites pendentes se o usuário for master', async () => {
        // Arrange
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink as any);
        (prismaMock.$transaction as jest.Mock).mockResolvedValue([[mockValidInvite], 1]);

        // Act
        const response = await request(app).get('/api/v1/invite/property/1/pending');

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].emailConvidado).toBe(newInvitedUser.email);
    });
  });
});