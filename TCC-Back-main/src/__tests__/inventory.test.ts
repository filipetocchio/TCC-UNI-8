// Todos direitos autorais reservados pelo QOTA.

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';
import { EstadoConservacao } from '@prisma/client';

// Mock do middleware de autenticação, agora com os tipos corretos.
jest.mock('../middleware/authMiddleware', () => ({
  protect: (req: Request, res: Response, next: NextFunction) => {
    req.user = { id: 1, email: 'test@qota.com', nomeCompleto: 'Usuário de Teste' };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

// Mock completo que corresponde ao modelo 'Propriedades' do Prisma.
const mockProperty = {
    id: 1,
    nomePropriedade: 'Casa de Praia',
    tipo: 'Casa',
    valorEstimado: 500000,
    enderecoCep: '12345-678',
    enderecoCidade: 'Florianópolis',
    enderecoBairro: 'Jurerê',
    enderecoLogradouro: 'Rua das Flores',
    enderecoNumero: '123',
    enderecoComplemento: null,
    enderecoPontoReferencia: null,
    dataCadastro: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    excludedAt: null,
};

// Mock completo que corresponde ao modelo 'ItemInventario' do Prisma.
const mockInventoryItem = {
  id: 1,
  idPropriedade: 1,
  nome: 'Cadeira de Praia',
  quantidade: 4,
  estadoConservacao: EstadoConservacao.BOM,
  categoria: 'Móveis',
  dataAquisicao: null,
  descricao: null,
  valorEstimado: null,
  codigoBarras: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  excludedAt: null,
};

// Mock completo que corresponde ao modelo 'Notificacao'.
const mockNotification = {
    id: 1,
    idPropriedade: 1,
    idAutor: 1,
    mensagem: "Notificação de teste",
    createdAt: new Date(),
};


describe('Endpoints de Inventário (/api/v1/inventory)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /create', () => {
    it('Deve criar um novo item de inventário com sucesso', async () => {
      prismaMock.propriedades.findFirst.mockResolvedValue(mockProperty);
      prismaMock.itemInventario.create.mockResolvedValue(mockInventoryItem);
      prismaMock.notificacao.create.mockResolvedValue(mockNotification);

      const response = await request(app)
        .post('/api/v1/inventory/create')
        .send({
          idPropriedade: 1,
          nome: 'Cadeira de Praia',
          quantidade: 4,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.nome).toBe('Cadeira de Praia');
    });

    it('Deve retornar erro 404 se a propriedade não for encontrada', async () => {
      prismaMock.propriedades.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/inventory/create')
        .send({ idPropriedade: 999, nome: 'Item Fantasma' });

      expect(response.status).toBe(404);
      // Ajustado para esperar a mensagem de erro correta e mais completa.
      expect(response.body.message).toContain('A propriedade informada não foi encontrada ou está inativa.');
    });
  });

  describe('GET /property/:propertyId', () => {
    it('Deve retornar uma lista de itens de inventário para uma propriedade', async () => {
      prismaMock.itemInventario.findMany.mockResolvedValue([mockInventoryItem]);

      const response = await request(app).get('/api/v1/inventory/property/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0].nome).toBe('Cadeira de Praia');
    });
  });

  describe('PUT /:id', () => {
    it('Deve atualizar um item de inventário existente', async () => {
      const updatedItem = { ...mockInventoryItem, nome: 'Guarda-sol', quantidade: 2 };
      prismaMock.itemInventario.findFirst.mockResolvedValue(mockInventoryItem);
      prismaMock.itemInventario.update.mockResolvedValue(updatedItem);
      prismaMock.notificacao.create.mockResolvedValue(mockNotification);

      const response = await request(app)
        .put('/api/v1/inventory/1')
        .send({ nome: 'Guarda-sol', quantidade: 2 });

      expect(response.status).toBe(200);
      expect(response.body.data.nome).toBe('Guarda-sol');
      expect(response.body.data.quantidade).toBe(2);
    });
  });

  describe('DELETE /:id', () => {
    it('Deve realizar o soft-delete de um item de inventário', async () => {
      prismaMock.itemInventario.findFirst.mockResolvedValue(mockInventoryItem);
      prismaMock.itemInventario.update.mockResolvedValue({ ...mockInventoryItem, excludedAt: new Date() });
      prismaMock.notificacao.create.mockResolvedValue(mockNotification);

      const response = await request(app)
        .delete('/api/v1/inventory/1');
      
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Item removido com sucesso');
    });
  });
});