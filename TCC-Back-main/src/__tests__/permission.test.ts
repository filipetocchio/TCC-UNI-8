// Todos direitos autorais reservados pelo QOTA.

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';

// Configuração da aplicação Express para o ambiente de teste.
const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

// --- MOCKS DE DADOS E TOKENS ---

// Define uma chave secreta para os tokens JWT apenas no ambiente de teste.
const ACCESS_TOKEN_SECRET = 'chave-secreta-para-testes-de-api';
process.env.ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET;

// Mock dos usuários que serão utilizados nos cenários de teste.
const masterUser = { id: 1, email: 'master@qota.com', nomeCompleto: 'Master da Silva' };
const commonUser = { id: 2, email: 'comum@qota.com', nomeCompleto: 'Comum de Souza' };

// Gera tokens JWT válidos para cada usuário mockado.
const masterToken = jwt.sign(
  { userId: masterUser.id, email: masterUser.email, nomeCompleto: masterUser.nomeCompleto },
  ACCESS_TOKEN_SECRET
);
const commonToken = jwt.sign(
  { userId: commonUser.id, email: commonUser.email, nomeCompleto: commonUser.nomeCompleto },
  ACCESS_TOKEN_SECRET
);

// Mocks dos registros de vínculo, agora com todas as propriedades do schema do Prisma.
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

  // Limpa todos os mocks antes de cada teste para garantir o isolamento.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /:id (Listar Membros de uma Propriedade)', () => {
    it('Deve retornar a lista de membros de uma propriedade com sucesso', async () => {
      (prismaMock.$transaction as jest.Mock).mockResolvedValue([[mockMasterLink, mockCommonLink], 2]);

      const response = await request(app)
        .get('/api/v1/permission/1')
        .set('Authorization', `Bearer ${masterToken}`); // Simula uma requisição autenticada.

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.vinculos).toHaveLength(2);
    });

    it('Deve retornar 401 Unauthorized se nenhum token for fornecido', async () => {
        const response = await request(app).get('/api/v1/permission/1');
        expect(response.status).toBe(401);
    });
  });

  describe('PUT /:id (Atualizar Permissão)', () => {
    it('Deve permitir que um master promova outro membro para "master"', async () => {
      prismaMock.usuariosPropriedades.findUnique.mockResolvedValue(mockCommonLink);
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink);
      prismaMock.usuariosPropriedades.update.mockResolvedValue({ ...mockCommonLink, permissao: 'proprietario_master' });

      const response = await request(app)
        .put('/api/v1/permission/102')
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ permissao: 'proprietario_master' });
      
      expect(response.status).toBe(200);
      expect(response.body.data.permissao).toBe('proprietario_master');
    });

    it('Deve impedir que o último master seja rebaixado', async () => {
      prismaMock.usuariosPropriedades.findUnique.mockResolvedValue(mockMasterLink);
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink);
      prismaMock.usuariosPropriedades.count.mockResolvedValue(1); // Simula que existe apenas 1 master.

      const response = await request(app)
        .put('/api/v1/permission/101')
        .set('Authorization', `Bearer ${masterToken}`)
        .send({ permissao: 'proprietario_comum' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Não é possível rebaixar o último proprietário master');
    });

    it('Deve impedir que um usuário comum altere permissões', async () => {
        prismaMock.usuariosPropriedades.findUnique.mockResolvedValue(mockMasterLink);
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(null); // Simula que o requisitante não é master.

        const response = await request(app)
            .put('/api/v1/permission/101')
            .set('Authorization', `Bearer ${commonToken}`) // Tenta a ação como usuário comum.
            .send({ permissao: 'proprietario_comum' });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('Acesso negado');
    });
  });

  describe('DELETE /unlink/me/:vinculoId (Auto-desvinculação)', () => {
    it('Deve permitir que um usuário comum se desvincule da propriedade', async () => {
      const mockVinculoComPropriedade = { ...mockCommonLink, propriedade: { id: 1, nomePropriedade: 'Casa de Praia' } };

      (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          usuariosPropriedades: {
            findUnique: jest.fn().mockResolvedValue(mockVinculoComPropriedade),
            findFirst: jest.fn().mockResolvedValue(mockMasterLink),
            update: jest.fn(),
            delete: jest.fn(),
          },
          notificacao: { create: jest.fn() },
        };
        return await callback(mockTx);
      });

      const response = await request(app)
        .delete('/api/v1/permission/unlink/me/102')
        .set('Authorization', `Bearer ${commonToken}`); // Ação executada pelo usuário comum.

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('desvinculado da propriedade com sucesso');
    });

    it('Deve impedir que um usuário tente se desvincular com o vínculo de outra pessoa', async () => {
        const mockVinculoComPropriedade = { ...mockCommonLink, propriedade: { id: 1, nomePropriedade: 'Casa de Praia' } };
        
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = {
                usuariosPropriedades: { findUnique: jest.fn().mockResolvedValue(mockVinculoComPropriedade) },
            };
            return await callback(mockTx);
        });

        const response = await request(app)
            .delete('/api/v1/permission/unlink/me/102')
            .set('Authorization', `Bearer ${masterToken}`); // Usuário master tentando apagar vínculo do comum.

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Você só pode remover o seu próprio vínculo');
    });
  });
});