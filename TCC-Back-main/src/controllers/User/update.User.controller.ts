// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Atualização de Dados do Usuário
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint de atualização do perfil de um usuário.
 * Ele permite a modificação parcial dos dados e é um processo seguro, garantindo que
 * um usuário só possa modificar suas próprias informações.
 *
 * O controlador é responsável por:
 * 1.  Validar a autenticação, autorização e os dados de entrada.
 * 2.  Verificar se o usuário a ser atualizado existe e está ativo.
 * 3.  Garantir que o novo e-mail (se fornecido) não esteja em uso por outra conta.
 * 4.  Processar o upload de uma nova foto de perfil e/ou a atualização de outros dados.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'user.log';

// --- Constantes e Schemas de Validação ---
const BCRYPT_SALT_ROUNDS = 10;

const paramsSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)),
});

const updateUserSchema = z.object({
  email: z.string().email('O formato do e-mail é inválido.').optional(),
  password: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres.').optional(),
  nomeCompleto: z.string().min(1).max(100).optional(),
  telefone: z.string().optional().refine((val) => !val || /^\d{10,11}$/.test(val), {
    message: 'O número de telefone deve ter 10 ou 11 dígitos.',
  }),
});

/**
 * Processa a atualização dos dados de um usuário específico.
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: requesterId } = req.user;
    const { id: targetUserId } = paramsSchema.parse(req.params);
    const dataToUpdateParsed = updateUserSchema.parse(req.body);

    // --- 2. Verificação de Autorização (Segurança) ---
    // Garante que um usuário só pode atualizar seu próprio perfil.
    if (requesterId !== targetUserId) {
      return res.status(403).json({ success: false, message: 'Acesso negado. Você só pode editar seu próprio perfil.' });
    }

    // --- 3. Verificação de Existência e Status do Usuário ---
    const existingUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existingUser || existingUser.excludedAt) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado ou inativo.' });
    }

    // --- 4. Verificação de Duplicidade de E-mail ---
    if (dataToUpdateParsed.email) {
      const duplicateEmailUser = await prisma.user.findFirst({
        where: { email: dataToUpdateParsed.email, id: { not: targetUserId }, excludedAt: null },
      });
      if (duplicateEmailUser) {
        return res.status(409).json({ success: false, message: 'Este e-mail já está em uso.' });
      }
    }

    // --- 5. Construção do Objeto de Atualização ---
    const dataToUpdate: Prisma.UserUpdateInput = { ...dataToUpdateParsed };
    if (dataToUpdateParsed.password) {
      dataToUpdate.password = await bcrypt.hash(dataToUpdateParsed.password, BCRYPT_SALT_ROUNDS);
    }

    // --- 6. Processamento do Upload da Foto de Perfil (se houver) ---
    if (req.file) {
      const { filename } = req.file;
      const url = `/uploads/profile/${filename}`;
      await prisma.userPhoto.upsert({
        where: { userId: targetUserId },
        create: { userId: targetUserId, filename, url },
        update: { filename, url, uploadedAt: new Date() },
      });
    }

    // --- 7. Execução da Atualização e Envio da Resposta ---
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: dataToUpdate,
      include: { userPhoto: true },
    });

    const responseData = {
      id: updatedUser.id,
      email: updatedUser.email,
      nomeCompleto: updatedUser.nomeCompleto,
      telefone: updatedUser.telefone,
      cpf: updatedUser.cpf,
      userPhoto: updatedUser.userPhoto
        ? { url: `${req.protocol}://${req.get('host')}${updatedUser.userPhoto.url}` }
        : null,
    };

    return res.status(200).json({
      success: true,
      message: 'Usuário atualizado com sucesso.',
      data: responseData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao atualizar usuário: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao atualizar o usuário.',
    });
  }
};