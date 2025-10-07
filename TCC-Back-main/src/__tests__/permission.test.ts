// Todos direitos autorais reservados pelo QOTA.

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';

// Mock dinâmico do middleware de autenticação.
let mockUser: { id: number; email: string; nomeCompleto: string } | undefined = undefined;
jest.mock('../middleware/authMiddleware', () => ({
  protect: (req: Request, res: Response, next: NextFunction) => {
    req.user = mockUser;
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

// --- MOCKS DE DADOS COMPLETOS ---

const masterUser = { id: 1, email: 'master@qota.com', nomeCompleto: 'Master da Silva' };
const commonUser = { id: 2, email: 'comum@qota.com', nomeCompleto: 'Comum de Souza' };

const mockMasterLink = {
  id: 101,
  idUsuario: masterUser.id,
  idPropriedade: 1,
  permissao: 'proprietario_master',
  porcentagemCota: 70,
  dataVinculo: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  excludedAt: null,
};

const mockCommonLink = {
  id: 102,
  idUsuario: commonUser.id,
  idPropriedade: 1,
  permissao: 'proprietario_comum',
  porcentagemCota: 30,
  dataVinculo: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  excludedAt: null,
};


describe('Endpoints de Permissões (/api/v1/permission)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = masterUser; // Por padrão, o usuário logado nos testes é o master.
  });

  describe('GET /:id (Listar Membros)', () => {
    it('Deve retornar a lista de membros de uma propriedade com sucesso', async () => {
      // O método $transaction agora espera um array de resultados.
      (prismaMock.$transaction as jest.Mock).mockResolvedValue([[mockMasterLink, mockCommonLink], 2]);

      const response = await request(app).get('/api/v1/permission/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vinculos).toHaveLength(2);
    });
  });

  describe('PUT /:id (Atualizar Permissão/Role)', () => {
    it('Deve permitir que um master rebaixe outro membro para "comum"', async () => {
      const targetLink = { ...mockCommonLink, id: 103, permissao: 'proprietario_master' };
      prismaMock.usuariosPropriedades.findUnique.mockResolvedValue(targetLink);
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink);
      prismaMock.usuariosPropriedades.count.mockResolvedValue(2); // Simula que existem 2 masters
      prismaMock.usuariosPropriedades.update.mockResolvedValue({ ...targetLink, permissao: 'proprietario_comum' });

      const response = await request(app)
        .put('/api/v1/permission/103')
        .send({ permissao: 'proprietario_comum' });
      
      expect(response.status).toBe(200);
      expect(response.body.data.permissao).toBe('proprietario_comum');
    });

    it('Deve impedir que o último master seja rebaixado (erro 400)', async () => {
      prismaMock.usuariosPropriedades.findUnique.mockResolvedValue(mockMasterLink);
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink);
      prismaMock.usuariosPropriedades.count.mockResolvedValue(1); // Apenas 1 master

      const response = await request(app)
        .put('/api/v1/permission/101')
        .send({ permissao: 'proprietario_comum' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Não é possível rebaixar o último proprietário master');
    });
  });

  describe('PUT /cota/:vinculoId (Atualizar Cota)', () => {
    it('Deve permitir que um master edite a cota de outro membro e reajuste a sua', async () => {
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = {
                usuariosPropriedades: {
                    findUnique: jest.fn().mockResolvedValue(mockCommonLink),
                    findFirst: jest.fn().mockResolvedValue(mockMasterLink),
                    findMany: jest.fn().mockResolvedValue([mockMasterLink, mockCommonLink]),
                    update: jest.fn().mockResolvedValue({}),
                }
            };
            return await callback(mockTx);
        });

        const response = await request(app)
            .put('/api/v1/permission/cota/102')
            .send({ porcentagemCota: 20 });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('Cotas atualizadas com sucesso');
    });
  });

  describe('DELETE /unlink/me/:vinculoId', () => {
    it('Deve permitir que um usuário comum se desvincule da propriedade', async () => {
        mockUser = commonUser;
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = {
                usuariosPropriedades: {
                    findUnique: jest.fn().mockResolvedValue(mockCommonLink),
                    findFirst: jest.fn().mockResolvedValue(mockMasterLink),
                    count: jest.fn().mockResolvedValue(2),
                    update: jest.fn().mockResolvedValue({}),
                    delete: jest.fn().mockResolvedValue({}),
                }
            };
            return await callback(mockTx);
        });

        const response = await request(app)
            .delete('/api/v1/permission/unlink/me/102');

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('desvinculado da propriedade com sucesso');
    });
  });
});

