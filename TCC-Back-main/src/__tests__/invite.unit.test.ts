/**
 * @file invite.unit.test.ts
 * @description Suíte de testes de unidade para o controller de criação de convites.
 * Testa a lógica de negócio e as regras de autorização de forma isolada do banco de dados.
 */
import { Request, Response } from 'express';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// --- Configuração do Mock do Prisma ---
// A variável do mock é declarada aqui, antes da chamada jest.mock.
const mockPrisma: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

// --- Mocking do Módulo Prisma ---
// Esta configuração instrui o Jest a substituir qualquer importação do '../utils/prisma'
// por nosso mock. A chamada é feita aqui no topo para evitar erros de hoisting.
jest.mock('../utils/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));

// Agora, importamos o controller APÓS o mock ter sido configurado.
import { createInvite } from '../controllers/Invite/create.Invite.controller';

describe('Unit Test: createInvite Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  // Reseta os mocks e o estado antes de cada teste para garantir o isolamento.
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      body: {
        emailConvidado: 'novo.membro@qota.com',
        idPropriedade: 1,
        permissao: 'proprietario_comum',
      },
      user: { // Simula um usuário autenticado vindo do middleware 'protect'
        id: 1,
        email: 'master@qota.com',
      },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('should create an invite successfully when called by a master owner', async () => {
    // Configuração do Cenário (Arrange):
    mockPrisma.usuariosPropriedades.findFirst.mockResolvedValue({ id: 1, idUsuario: 1, idPropriedade: 1, permissao: 'proprietario_master', dataVinculo: new Date(), createdAt: new Date(), updatedAt: new Date(), excludedAt: null, openedAt: new Date(), closedAt: null });
    mockPrisma.convite.create.mockResolvedValue({ id: 1, token: 'fake-token', emailConvidado: 'novo.membro@qota.com', idPropriedade: 1, idConvidadoPor: 1, permissao: 'proprietario_comum', dataExpiracao: new Date(), status: 'PENDENTE', aceitoEm: null, createdAt: new Date(), updatedAt: new Date() });

    // Execução (Act):
    await createInvite(mockRequest as Request, mockResponse as Response);

    // Validação (Assert):
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('Convite criado com sucesso'),
      })
    );
  });

  it('should return 403 Forbidden if the user is not a master owner', async () => {
    // Configuração do Cenário (Arrange):
    mockPrisma.usuariosPropriedades.findFirst.mockResolvedValue(null);

    // Execução (Act):
    await createInvite(mockRequest as Request, mockResponse as Response);

    // Validação (Assert):
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: expect.stringContaining('Acesso negado'),
    });
  });

  it('should return 409 Conflict if the invited user is already a member', async () => {
    // Configuração do Cenário (Arrange):
    mockPrisma.usuariosPropriedades.findFirst.mockResolvedValueOnce({ id: 1, idUsuario: 1, idPropriedade: 1, permissao: 'proprietario_master', dataVinculo: new Date(), createdAt: new Date(), updatedAt: new Date(), excludedAt: null, openedAt: new Date(), closedAt: null });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 2, email: 'novo.membro@qota.com', nomeCompleto: 'Membro Antigo', password: '', cpf: '12345678901', refreshToken: null, telefone: null, dataCadastro: new Date(), dataConsentimento: new Date(), versaoTermos: '1.0', createdAt: new Date(), updatedAt: new Date(), excludedAt: null, openedAt: new Date(), closedAt: null });
    mockPrisma.usuariosPropriedades.findFirst.mockResolvedValueOnce({ id: 2, idUsuario: 2, idPropriedade: 1, permissao: 'proprietario_comum', dataVinculo: new Date(), createdAt: new Date(), updatedAt: new Date(), excludedAt: null, openedAt: new Date(), closedAt: null });

    // Execução (Act):
    await createInvite(mockRequest as Request, mockResponse as Response);

    // Validação (Assert):
    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: 'Este usuário já é membro da propriedade.',
    });
  });
});