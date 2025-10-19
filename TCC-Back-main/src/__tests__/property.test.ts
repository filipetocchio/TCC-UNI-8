// Todos direitos autorais reservados pelo QOTA.

/**
 * Suite de Testes para os Endpoints de Propriedades
 *
 * Descrição:
 * Este arquivo contém os testes de integração para as rotas de gerenciamento de
 * propriedades (`/api/v1/property`). O objetivo é validar o comportamento de
 * criação, listagem, busca, atualização e exclusão, garantindo a correta
 * aplicação das regras de negócio e das validações de segurança.
 */
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';
import { createNotification } from '../utils/notification.service';
import { protect } from '../middleware/authMiddleware';

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

const mockProperty = {
  id: 1,
  nomePropriedade: 'Casa de Praia',
  tipo: 'Casa',
  totalFracoes: 52,
  diariasPorFracao: 7.019,
  excludedAt: null,
  usuarios: [ { usuario: { id: masterUser.id } }, { usuario: { id: commonUser.id } } ],
};

const mockMasterPermission = {
    id: 101,
    idUsuario: masterUser.id,
    idPropriedade: mockProperty.id,
    permissao: 'proprietario_master',
    propriedade: mockProperty,
};

// --- Suite Principal de Testes de Propriedades ---
describe('Endpoints de Propriedades (/api/v1/property)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
      req.user = masterUser;
      next();
    });
    mockedCreateNotification.mockResolvedValue(undefined);
  });

  // Testes para os cenários de sucesso das operações.
  describe('Cenários de Sucesso', () => {
    it('POST /create: Deve criar uma nova propriedade e vincular o criador como master', async () => {
      // Arrange
      prismaMock.propriedades.create.mockResolvedValue(mockProperty as any);

      // Act
      const response = await request(app).post('/api/v1/property/create').send({
        nomePropriedade: 'Casa de Praia', tipo: 'Casa', totalFracoes: 52,
      });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.nomePropriedade).toBe('Casa de Praia');
      expect(prismaMock.propriedades.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
            totalFracoes: 52,
            diariasPorFracao: 365 / 52,
            usuarios: { create: [ expect.objectContaining({ numeroDeFracoes: 52, saldoDiariasAtual: 365 }) ] }
        })
      }));
      expect(mockedCreateNotification).toHaveBeenCalled();
    });

    it('GET /:id: Deve retornar os detalhes de uma propriedade se o usuário for membro', async () => {
      // Arrange
      prismaMock.propriedades.findFirst.mockResolvedValue(mockProperty as any);

      // Act
      const response = await request(app).get('/api/v1/property/1');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(1);
    });

    it('PUT /:id: Deve permitir que um master atualize uma propriedade', async () => {
        // Arrange
        const updatedPropertyData = { ...mockProperty, nomePropriedade: 'Casa de Campo' };
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = {
                usuariosPropriedades: { findFirst: jest.fn().mockResolvedValue(mockMasterPermission) },
                propriedades: { update: jest.fn().mockResolvedValue(updatedPropertyData) }
            };
            return await callback(mockTx);
        });
  
        // Act
        const response = await request(app).put('/api/v1/property/1').send({ nomePropriedade: 'Casa de Campo' });
  
        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data.nomePropriedade).toBe('Casa de Campo');
    });
  });

  // Testes para os cenários de falha de autorização.
  describe('Cenários de Falha de Autorização (Segurança)', () => {
    it('GET /:id: Deve retornar 404 se o usuário não for membro da propriedade', async () => {
        // Arrange
        mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = { id: 99, email: 'estranho@email.com', nomeCompleto: 'Usuário Estranho' };
            next();
        });
        prismaMock.propriedades.findFirst.mockResolvedValue(null);

        // Act
        const response = await request(app).get('/api/v1/property/1');
  
        // Assert
        expect(response.status).toBe(404);
        expect(response.body.message).toContain('não encontrada ou acesso negado');
    });

    it('PUT /:id: Deve retornar 403 se um cotista comum tentar atualizar uma propriedade', async () => {
        // Arrange
        mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = commonUser;
            next();
        });
        // Simula a falha na verificação de permissão de master.
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = { usuariosPropriedades: { findFirst: jest.fn().mockResolvedValue(null) } };
            // A transação irá lançar um erro que o controlador converterá para 403.
            return await callback(mockTx);
        });
        
        // Act
        const response = await request(app).put('/api/v1/property/1').send({ nomePropriedade: 'Tentativa de Edição' });

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Acesso negado');
    });

    it('DELETE /:id: Deve retornar 403 se um cotista comum tentar excluir uma propriedade', async () => {
        // Arrange
        mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = commonUser;
            next();
        });
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(null);

        // Act
        const response = await request(app).delete('/api/v1/property/1');

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Acesso negado');
    });
  });
});