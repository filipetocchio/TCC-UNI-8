// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const linkUserSchema = z.object({
  idPropriedade: z.number().int().positive('ID da propriedade deve ser um número inteiro positivo'),
  idUsuario: z.number().int().positive('ID do usuário deve ser um número inteiro positivo'),
  permissao: z.enum(['proprietario_master', 'proprietario_comum'], {
    errorMap: () => ({ message: 'Permissão inválida. Use "proprietario_master" ou "proprietario_comum"' }),
  }),
});

const linkUsersSchema = z.array(linkUserSchema).min(1, 'Pelo menos um vínculo deve ser fornecido');

const linkUserPermission = async (req: Request, res: Response) => {
  try {
    const parsedBody = linkUsersSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.success === false ? parsedBody.error.errors : [] });
    }

    const vinculos = parsedBody.data;

    const errors: { index: number; message: string }[] = [];
    const novosVinculos: any[] = [];

    for (let i = 0; i < vinculos.length; i++) {
      const { idPropriedade, idUsuario, permissao } = vinculos[i];

      const propriedade = await prisma.propriedades.findUnique({
        where: { id: idPropriedade },
      });
      if (!propriedade) {
        errors.push({ index: i, message: `Propriedade com ID ${idPropriedade} não encontrada` });
        continue;
      }

      const usuario = await prisma.user.findUnique({
        where: { id: idUsuario },
      });
      if (!usuario) {
        errors.push({ index: i, message: `Usuário com ID ${idUsuario} não encontrado` });
        continue;
      }

      const vinculoExistente = await prisma.usuariosPropriedades.findUnique({
        where: {
          idUsuario_idPropriedade: {
            idUsuario,
            idPropriedade,
          },
        },
      });
      if (vinculoExistente) {
        errors.push({
          index: i,
          message: `Usuário com ID ${idUsuario} já está vinculado à propriedade ${idPropriedade}`,
        });
        continue;
      }

      const novoVinculo = await prisma.usuariosPropriedades.create({
        data: {
          idUsuario,
          idPropriedade,
          permissao,
          dataVinculo: new Date(),
        },
        include: {
          usuario: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
            },
          },
          propriedade: {
            select: {
              id: true,
              nomePropriedade: true,
            },
          },
        },
      });

      novosVinculos.push({
        id: novoVinculo.id,
        idUsuario: novoVinculo.idUsuario,
        idPropriedade: novoVinculo.idPropriedade,
        permissao: novoVinculo.permissao,
        dataVinculo: novoVinculo.dataVinculo,
        usuario: novoVinculo.usuario,
        propriedade: novoVinculo.propriedade,
      });
    }

    if (errors.length > 0 && novosVinculos.length === 0) {
      return res.status(400).json({ error: errors });
    }

    return res.status(201).json(novosVinculos);
  } catch (error) {
    console.error('Erro ao vincular usuários às propriedades:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { linkUserPermission };