// Todos direitos autorais reservados pelo QOTA.

/**
 * Suite de Testes para os Endpoints de Permissões
 *
 * Descrição:
 * Este arquivo contém os testes de integração para as rotas de gerenciamento de
 * permissões e vínculos. O objetivo é validar cenários críticos como a listagem
 * de membros, alteração de permissões e frações, e desvinculação de usuários,
 * garantindo que as regras de negócio do novo fluxo de frações sejam aplicadas.
 */
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';
import { protect } from '../middleware/authMiddleware';
import { createNotification } from '../utils/notification.service';

// --- Mocks das Dependências ---
jest.mock('../middleware/authMiddleware', () => ({
  protect: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));
const mockedProtect = protect as jest.Mock;

jest.mock('../utils/notification.service');

// --- Configuração da Aplicação de Teste ---
const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

// --- Dados Mockados para os Testes ---
const masterUser = { id: 1, email: 'master@qota.com', nomeCompleto: 'Master da Silva' };
const commonUser = { id: 2, email: 'comum@qota.com', nomeCompleto: 'Comum de Souza' };

const mockProperty = { id: 1, totalFracoes: 52, diariasPorFracao: 7.019 };

const mockMasterLink = {
  id: 101,
  idUsuario: masterUser.id,
  idPropriedade: 1,
  permissao: 'proprietario_master',
  numeroDeFracoes: 40, // Deixa espaço para testar a adição de frações
  saldoDiariasAtual: 280.76,
  propriedade: mockProperty,
  usuario: masterUser,
};

const mockCommonLink = {
  id: 102,
  idUsuario: commonUser.id,
  idPropriedade: 1,
  permissao: 'proprietario_comum',
  numeroDeFracoes: 2,
  saldoDiariasAtual: 14.03,
  propriedade: mockProperty,
  usuario: commonUser,
};

// --- Suite Principal de Testes de Permissões ---
describe('Endpoints de Permissões (/api/v1/permission)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
      req.user = masterUser;
      next();
    });
    (createNotification as jest.Mock).mockResolvedValue(undefined);
  });

  // Testes para o endpoint que lista os membros de uma propriedade.
  describe('GET /:id (Listar Membros)', () => {
    it('Deve retornar a lista de membros se o usuário for membro', async () => {
      // Arrange
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink as any);
      (prismaMock.$transaction as jest.Mock).mockResolvedValue([ [mockMasterLink, mockCommonLink], 2 ]);

      // Act
      const response = await request(app).get('/api/v1/permission/1');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data[0]).toHaveProperty('numeroDeFracoes');
      expect(response.body.data[0]).toHaveProperty('saldoDiariasAtual');
    });
  });

  // Testes para o endpoint que atualiza as frações de um membro.
  describe('PUT /cota/:vinculoId (Atualizar Frações)', () => {
    it('Deve permitir que um master atualize as frações de um membro com sucesso', async () => {
        // Arrange
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = {
                usuariosPropriedades: { 
                    findUnique: jest.fn().mockResolvedValue(mockCommonLink),
                    findFirst: jest.fn().mockResolvedValue(mockMasterLink),
                    findMany: jest.fn().mockResolvedValue([mockMasterLink, mockCommonLink]),
                    update: jest.fn(),
                },
                propriedades: { findUnique: jest.fn().mockResolvedValue(mockProperty) }
            };
            return await callback(mockTx);
        });

        // Act
        const response = await request(app).put('/api/v1/permission/cota/102').send({ numeroDeFracoes: 5 });
        
        // Assert
        expect(response.status).toBe(200);
        expect(response.body.message).toContain('frações do membro foram atualizadas');
    });

    it('Deve impedir que a soma de frações exceda o total da propriedade', async () => {
        // Arrange
        const mockTx = {
            usuariosPropriedades: { 
                findUnique: jest.fn().mockResolvedValue(mockCommonLink),
                findFirst: jest.fn().mockResolvedValue(mockMasterLink),
                findMany: jest.fn().mockResolvedValue([mockMasterLink, mockCommonLink]),
            },
            propriedades: { findUnique: jest.fn().mockResolvedValue(mockProperty) }
        };
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));
        
        // Act: Tenta atribuir 20 frações, quando o total já é 42, excedendo o limite de 52 (40 + 20 > 52).
        const response = await request(app).put('/api/v1/permission/cota/102').send({ numeroDeFracoes: 20 });

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('excederia o limite da propriedade');
    });
  });

  // Testes para o endpoint de auto-desvinculação.
  describe('DELETE /unlink/me/:vinculoId', () => {
    it('Deve permitir que um cotista se desvincule e transferir suas frações', async () => {
        // Arrange
        mockedProtect.mockImplementation((req: Request, res: Response, next: NextFunction) => {
            req.user = commonUser;
            next();
        });

        const mockTx = {
            usuariosPropriedades: { 
                findUnique: jest.fn().mockResolvedValue({ ...mockCommonLink, propriedade: mockProperty }),
                findFirst: jest.fn().mockResolvedValue(mockMasterLink),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
        };
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

        // Act
        const response = await request(app).delete('/api/v1/permission/unlink/me/102');

        // Assert
        expect(response.status).toBe(200);
        expect(mockTx.usuariosPropriedades.update).toHaveBeenCalled();
    });
  });
});