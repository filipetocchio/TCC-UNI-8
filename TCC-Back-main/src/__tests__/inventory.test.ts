// Todos direitos autorais reservados pelo QOTA.

/**
 * Suite de Testes para os Endpoints de Inventário
 *
 * Descrição:
 * Este arquivo contém os testes de integração para as rotas de gerenciamento de
 * inventário. O objetivo é validar o comportamento de criação, listagem, busca,
 * atualização e exclusão de itens, garantindo a correta aplicação das regras de
 * negócio e, principalmente, das validações de segurança e autorização.
 */
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';
import { EstadoConservacao } from '@prisma/client';
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
const masterUser = { id: 1, nomeCompleto: 'Usuário Master', email: 'master@qota.com' };
const commonUser = { id: 2, nomeCompleto: 'Usuário Comum', email: 'comum@qota.com' };

const mockProperty = { id: 1, nomePropriedade: 'Casa de Praia', excludedAt: null };
const mockMasterPermission = { id: 101, idUsuario: masterUser.id, idPropriedade: 1, permissao: 'proprietario_master' };

const mockInventoryItem = {
  id: 1,
  idPropriedade: 1,
  nome: 'Cadeira de Praia',
  quantidade: 4,
  estadoConservacao: EstadoConservacao.BOM,
  // Adiciona a propriedade aninhada para evitar erros de 'undefined' nos controladores.
  propriedade: { nomePropriedade: 'Casa de Praia' },
  createdAt: new Date(),
  updatedAt: new Date(),
  excludedAt: null,
};

// --- Suite Principal de Testes de Inventário ---
describe('Endpoints de Inventário (/api/v1/inventory)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Padrão: simula que o requisitante é o master.
    mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
        req.user = masterUser;
        next();
    });
    // Garante que o mock da notificação retorne uma Promise para o fluxo "fire-and-forget".
    mockedCreateNotification.mockResolvedValue(undefined);
  });

  // Testes para os cenários de sucesso das operações.
  describe('Cenários de Sucesso', () => {
    it('POST /create: Deve criar um item se o usuário for membro', async () => {
      // Arrange
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterPermission as any);
      prismaMock.propriedades.findFirst.mockResolvedValue(mockProperty as any);
      prismaMock.itemInventario.create.mockResolvedValue(mockInventoryItem as any);

      // Act
      const response = await request(app).post('/api/v1/inventory/create').send({ idPropriedade: 1, nome: 'Cadeira de Praia' });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.nome).toBe('Cadeira de Praia');
      expect(mockedCreateNotification).toHaveBeenCalled();
    });

    it('GET /property/:propertyId: Deve listar itens se o usuário for membro', async () => {
      // Arrange
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterPermission as any);
      (prismaMock.$transaction as jest.Mock).mockResolvedValue([[mockInventoryItem], 1]);

      // Act
      const response = await request(app).get('/api/v1/inventory/property/1');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination.totalRecords).toBe(1);
    });

    it('PUT /:id: Deve atualizar um item se o usuário for master', async () => {
        // Arrange
        prismaMock.itemInventario.findFirst.mockResolvedValue(mockInventoryItem as any);
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterPermission as any);
        prismaMock.itemInventario.update.mockResolvedValue({ ...mockInventoryItem, nome: 'Guarda-sol' } as any);
  
        // Act
        const response = await request(app).put('/api/v1/inventory/1').send({ nome: 'Guarda-sol' });
  
        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data.nome).toBe('Guarda-sol');
        expect(mockedCreateNotification).toHaveBeenCalled();
      });
  });

  // Testes para os cenários de falha de autorização.
  describe('Cenários de Falha de Autorização (Segurança)', () => {
    it('GET /property/:propertyId: Deve retornar 403 se o usuário não for membro', async () => {
        // Arrange
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(null);

        // Act
        const response = await request(app).get('/api/v1/inventory/property/1');

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Acesso negado');
    });

    it('PUT /:id: Deve retornar 403 se o usuário for um cotista comum', async () => {
        // Arrange
        mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = commonUser;
            next();
        });
        prismaMock.itemInventario.findFirst.mockResolvedValue(mockInventoryItem as any);
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(null);

        // Act
        const response = await request(app).put('/api/v1/inventory/1').send({ nome: 'Tentativa de Edição' });

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Acesso negado');
    });

    it('DELETE /:id: Deve retornar 403 se o usuário for um cotista comum', async () => {
        // Arrange
        mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = commonUser;
            next();
        });
        prismaMock.itemInventario.findFirst.mockResolvedValue(mockInventoryItem as any);
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(null);

        // Act
        const response = await request(app).delete('/api/v1/inventory/1');

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Acesso negado');
    });
  });
});