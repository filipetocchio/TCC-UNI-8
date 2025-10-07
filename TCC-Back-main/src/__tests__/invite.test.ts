// Todos direitos autorais reservados pelo QOTA.

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { apiV1Router } from '../routes/routes';
import { prismaMock } from '../../jest.setup';
import { StatusConvite } from '@prisma/client';

// Mock dinâmico do middleware de autenticação, agora com os tipos corretos.
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
const newInvitedUser = { id: 3, email: 'novo.convidado@qota.com', nomeCompleto: 'Novo Convidado' };

const mockProperty = { id: 1, nomePropriedade: 'Casa na Praia' };

// Mock completo para o modelo 'UsuariosPropriedades'.
const mockMasterLink = {
  id: 101,
  idUsuario: masterUser.id,
  idPropriedade: mockProperty.id,
  permissao: 'proprietario_master',
  porcentagemCota: 75,
  dataVinculo: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  excludedAt: null,
};

// Mock completo para o modelo 'Convite'.
const mockValidInvite = {
    id: 1,
    token: 'valid-token',
    emailConvidado: newInvitedUser.email,
    idPropriedade: mockProperty.id,
    idConvidadoPor: masterUser.id,
    permissao: 'proprietario_comum',
    porcentagemCota: 25.5,
    usuarioJaExiste: true,
    dataExpiracao: new Date(Date.now() + 86400000), // Válido por mais 1 dia
    status: StatusConvite.PENDENTE,
    aceitoEm: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};


describe('Endpoints de Convites (/api/v1/invite)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST / (Criar Convite)', () => {
    it('Deve permitir que um proprietário master crie um convite com sucesso', async () => {
      mockUser = masterUser;
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.convite.create.mockResolvedValue(mockValidInvite);

      const response = await request(app)
        .post('/api/v1/invite')
        .send({
          emailConvidado: 'novo@qota.com',
          idPropriedade: 1,
          permissao: 'proprietario_comum',
          porcentagemCota: 20,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('linkConvite');
    });

    it('Deve impedir que um usuário comum crie um convite (erro 403)', async () => {
      mockUser = commonUser;
      prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/invite')
        .send({
          emailConvidado: 'outro@qota.com',
          idPropriedade: 1,
          permissao: 'proprietario_comum',
          porcentagemCota: 10,
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Acesso negado');
    });

    it('Deve impedir que um master ceda mais cota do que possui (erro 400)', async () => {
        mockUser = masterUser;
        prismaMock.usuariosPropriedades.findFirst.mockResolvedValue(mockMasterLink); // Master tem 75%
  
        const response = await request(app)
          .post('/api/v1/invite')
          .send({
            emailConvidado: 'novo@qota.com',
            idPropriedade: 1,
            permissao: 'proprietario_comum',
            porcentagemCota: 80, // Tentando ceder 80%
          });
  
        expect(response.status).toBe(400);
        expect(response.body.message).toContain('não pode ceder 80% pois possui apenas 75%');
      });
  });

  describe('GET /verify/:token', () => {
    it('Deve retornar os detalhes de um convite válido', async () => {
      const mockInviteForVerify = {
        ...mockValidInvite,
        propriedade: { nomePropriedade: 'Casa de Praia' },
        convidadoPor: { nomeCompleto: 'Master da Silva' },
      };
      prismaMock.convite.findUnique.mockResolvedValue(mockInviteForVerify);

      const response = await request(app).get('/api/v1/invite/verify/valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.propriedade).toBe('Casa de Praia');
    });
  });

  describe('POST /accept/:token', () => {
    it('Deve permitir que um usuário aceite um convite válido', async () => {
        mockUser = newInvitedUser;
        (prismaMock.$transaction as jest.Mock).mockImplementation(async (callback) => {
            const mockTx = {
                convite: { 
                    findFirst: jest.fn().mockResolvedValue(mockValidInvite),
                    update: jest.fn().mockResolvedValue({})
                },
                usuariosPropriedades: {
                    findFirst: jest.fn().mockResolvedValue(mockMasterLink),
                    update: jest.fn().mockResolvedValue({}),
                    create: jest.fn().mockResolvedValue({ id: 102, idUsuario: newInvitedUser.id }),
                },
            };
            return await callback(mockTx);
        });

        const response = await request(app).post('/api/v1/invite/accept/valid-token');

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('Convite aceito!');
    });
  });
});

