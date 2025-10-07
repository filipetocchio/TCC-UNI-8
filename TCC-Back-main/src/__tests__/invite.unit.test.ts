// Todos direitos autorais reservados pelo QOTA.

import { acceptInvite } from '../controllers/Invite/accept.Invite.controller';
import { prisma } from '../utils/prisma';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

// Mock do Prisma Client para simular o banco de dados.
jest.mock('../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    convite: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    usuariosPropriedades: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Funções para criar mocks dos objetos Request e Response do Express.
const mockRequest = (params: any, user: any): Request => ({
  params,
  user,
} as unknown as Request);

const mockResponse = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

// --- MOCKS ATUALIZADOS ---

const mockUser = { id: 2, email: 'novo.cotista@qota.com' };

const mockValidInvite = {
  id: 1,
  token: 'valid-token',
  emailConvidado: 'novo.cotista@qota.com',
  idPropriedade: 10,
  idConvidadoPor: 1,
  permissao: 'proprietario_comum',
  porcentagemCota: 25.5,       
  usuarioJaExiste: true,       
  status: 'PENDENTE' as const, // Assegura o tipo correto para o enum
  dataExpiracao: new Date(Date.now() + 24 * 60 * 60 * 1000),
};

const mockMasterLink = {
  id: 101,
  idUsuario: 1,
  idPropriedade: 10,
  porcentagemCota: 70,         
  permissao: 'proprietario_master'
};


describe('acceptInvite Controller - Teste de Cenários', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================================
  // CENÁRIOS DE FALHA
  // ==================================

  it('Deve retornar erro 401 se o usuário não estiver autenticado', async () => {
    const req = mockRequest({ token: 'some-token' }, undefined);
    const res = mockResponse();
    await acceptInvite(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Usuário não autenticado." });
  });

  it('Deve retornar erro se o convite não for encontrado', async () => {
    const req = mockRequest({ token: 'invalid-token' }, mockUser);
    const res = mockResponse();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockTx = { convite: { findFirst: jest.fn().mockResolvedValue(null) } };
      return await callback(mockTx);
    });
    await acceptInvite(req, res);
    expect(res.status).toHaveBeenCalledWith(400); // Erros de validação retornam 400
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Convite inválido, expirado ou já utilizado." });
  });
  
  it('Deve retornar erro se o email do usuário não corresponder ao do convite', async () => {
    const req = mockRequest({ token: 'valid-token' }, { id: 3, email: 'wrong.user@qota.com' });
    const res = mockResponse();
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockTx = { convite: { findFirst: jest.fn().mockResolvedValue(mockValidInvite) } };
      return await callback(mockTx);
    });
    await acceptInvite(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Acesso negado: Este convite foi destinado a outro e-mail." });
  });

  // ==================================
  // CENÁRIO DE SUCESSO
  // ==================================
  
  it('Deve executar a transação com sucesso e retornar 200', async () => {
    const req = mockRequest({ token: 'valid-token' }, mockUser);
    const res = mockResponse();
    const newCreatedLink = { id: 202, idUsuario: mockUser.id, porcentagemCota: 25.5 };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      const mockTx = { 
        convite: { 
          findFirst: jest.fn().mockResolvedValue(mockValidInvite),
          update: jest.fn().mockResolvedValue({}),
        },
        usuariosPropriedades: { 
          findFirst: jest.fn().mockResolvedValue(mockMasterLink),
          update: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue(newCreatedLink),
        }
      };
      return await callback(mockTx);
    });

    await acceptInvite(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: "Convite aceito! A propriedade foi adicionada à sua conta.",
    }));
  });
});