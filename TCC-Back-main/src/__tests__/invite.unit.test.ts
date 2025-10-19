// Todos direitos autorais reservados pelo QOTA.

/**
 * Suite de Testes Unitários para o Controlador acceptInvite
 *
 * Descrição:
 * Este arquivo contém os testes unitários para o controlador `acceptInvite`.
 * Estes testes focam em isolar a lógica do controlador, mockando todas as suas
 * dependências externas para validar o comportamento em diversos cenários
 * de sucesso e falha de forma rápida e determinística.
 */
import { acceptInvite } from '../controllers/Invite/accept.Invite.controller';
import { prisma } from '../utils/prisma';
import { Request, Response } from 'express';
import { createNotification } from '../utils/notification.service';
import { Prisma } from '@prisma/client';

// --- Mocks das Dependências ---
jest.mock('../utils/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    convite: { updateMany: jest.fn() },
  },
}));

jest.mock('../utils/notification.service');
const mockedCreateNotification = createNotification as jest.Mock;

// --- Funções Auxiliares para Mocks ---
const mockRequest = (params: any, user: any): Request => ({ params, user } as unknown as Request);
const mockResponse = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

// --- Dados Mockados para os Testes ---
const mockUser = { id: 2, email: 'novo.cotista@qota.com', nomeCompleto: 'Novo Cotista' };
const mockProperty = { id: 10, diariasPorFracao: 7.019, nomePropriedade: 'Casa de Teste' };

const mockValidInvite = {
  id: 1, token: 'valid-token', emailConvidado: 'novo.cotista@qota.com',
  idPropriedade: 10, idConvidadoPor: 1, permissao: 'proprietario_comum',
  numeroDeFracoes: 2, status: 'PENDENTE' as const,
  dataExpiracao: new Date(Date.now() + 24 * 60 * 60 * 1000),
  propriedade: mockProperty,
};

const mockMasterLink = {
  id: 101, idUsuario: 1, idPropriedade: 10,
  numeroDeFracoes: 50, permissao: 'proprietario_master',
};

// --- Suite Principal de Testes Unitários ---
describe('Controlador acceptInvite - Testes Unitários', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Testes para os cenários de falha do controlador.
  describe('Cenários de Falha', () => {
    it('Deve retornar 400 se o convite não for encontrado', async () => {
      // Arrange
      const req = mockRequest({ token: 'invalid-token' }, mockUser);
      const res = mockResponse();
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Convite inválido, expirado ou já utilizado.'));
      // Act
      await acceptInvite(req, res);
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Convite inválido, expirado ou já utilizado." });
    });
    
    it('Deve retornar 400 se o master não tiver frações suficientes', async () => {
        // Arrange
        const req = mockRequest({ token: 'valid-token' }, mockUser);
        const res = mockResponse();
        (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('O proprietário que enviou o convite não possui frações suficientes (1) para ceder.'));
        // Act
        await acceptInvite(req, res);
        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('não possui frações suficientes') }));
    });

    it('Deve retornar 400 se o convidante não for mais um master', async () => {
        // Arrange
        const req = mockRequest({ token: 'valid-token' }, mockUser);
        const res = mockResponse();
        (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('O usuário que o convidou não é mais um proprietário master desta propriedade.'));
        // Act
        await acceptInvite(req, res);
        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('não é mais um proprietário master') }));
    });
  });

  // Testes para o cenário de sucesso do controlador.
  describe('Cenário de Sucesso', () => {
    it('Deve executar a transação, disparar a notificação e retornar 200', async () => {
      // Arrange
      const req = mockRequest({ token: 'valid-token' }, mockUser);
      const res = mockResponse();
      
      // Simula que a transação foi bem-sucedida e retornou o payload da notificação.
      (prisma.$transaction as jest.Mock).mockResolvedValue({
        idPropriedade: mockValidInvite.idPropriedade,
      });
      mockedCreateNotification.mockResolvedValue(undefined);

      // Act
      await acceptInvite(req, res);

      // Assert
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockedCreateNotification).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Convite aceito com sucesso! A propriedade agora faz parte da sua conta.",
      });
    });
  });
});