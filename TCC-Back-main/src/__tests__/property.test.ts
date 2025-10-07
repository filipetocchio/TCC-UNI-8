// Todos direitos autorais reservados pelo QOTA.

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';

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

// --- MOCKS DE DADOS COMPLETOS ---
// Estes objetos agora correspondem 100% à estrutura do schema.prisma.

const mockFullUser = {
  id: 1,
  email: 'test@qota.com',
  password: 'hashedPassword',
  refreshToken: null,
  nomeCompleto: 'Usuário de Teste',
  telefone: null,
  cpf: '11122233344',
  dataCadastro: new Date(),
  dataConsentimento: new Date(),
  versaoTermos: '1.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  excludedAt: null,
};

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

const mockNotification = {
    id: 1,
    idPropriedade: 1,
    idAutor: 1,
    mensagem: "Notificação de teste",
    createdAt: new Date(),
};


describe('Endpoints de Propriedades (/api/v1/property)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /create', () => {
    it('Deve criar uma nova propriedade com sucesso', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockFullUser);
      prismaMock.propriedades.create.mockResolvedValue(mockProperty);

      const response = await request(app)
        .post('/api/v1/property/create')
        .send({
          nomePropriedade: 'Casa de Praia',
          tipo: 'Casa',
          userId: 1,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.nomePropriedade).toBe('Casa de Praia');
    });

    it('Deve retornar erro 404 se o usuário criador não for encontrado', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/property/create')
        .send({
          nomePropriedade: 'Casa Fantasma',
          tipo: 'Casa',
          userId: 999,
        });
      
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Usuário criador não encontrado');
    });
  });

  describe('GET /:id', () => {
    it('Deve retornar os detalhes de uma propriedade existente', async () => {
      prismaMock.propriedades.findUnique.mockResolvedValue(mockProperty);

      const response = await request(app)
        .get('/api/v1/property/1');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
    });

    it('Deve retornar erro 404 para uma propriedade que não existe', async () => {
      prismaMock.propriedades.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/property/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Propriedade não encontrada');
    });
  });

  describe('PUT /:id', () => {
    it('Deve atualizar uma propriedade com sucesso', async () => {
        const updatedProperty = { ...mockProperty, nomePropriedade: 'Casa de Campo' };
        prismaMock.propriedades.findUnique.mockResolvedValue(mockProperty);
        prismaMock.propriedades.update.mockResolvedValue(updatedProperty);
        prismaMock.notificacao.create.mockResolvedValue(mockNotification);

        const response = await request(app)
            .put('/api/v1/property/1')
            .send({ nomePropriedade: 'Casa de Campo' });

        expect(response.status).toBe(200);
        expect(response.body.data.nomePropriedade).toBe('Casa de Campo');
    });
  });

  describe('DELETE /:id', () => {
    it('Deve realizar o soft-delete de uma propriedade com sucesso', async () => {
        prismaMock.propriedades.findUnique.mockResolvedValue(mockProperty);
        prismaMock.propriedades.update.mockResolvedValue({ ...mockProperty, excludedAt: new Date() });

        const response = await request(app)
            .delete('/api/v1/property/1');

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('Propriedade deletada com sucesso');
    });
  });
});