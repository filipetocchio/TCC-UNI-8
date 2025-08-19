import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const updatePermissionSchema = z.object({
  idPropriedade: z.number().int().positive('ID da propriedade deve ser um número inteiro positivo'),
  idUsuario: z.number().int().positive('ID do usuário deve ser um número inteiro positivo'),
  permissao: z.enum(['proprietario_master', 'proprietario_comum'], {
    errorMap: () => ({ message: 'Permissão inválida. Use "proprietario_master" ou "proprietario_comum"' }),
  }),
});

const updatePermissionsSchema = z.array(updatePermissionSchema).min(1, 'Pelo menos um vínculo deve ser fornecido');

const updateUserPermission = async (req: Request, res: Response) => {
  try {
    const hasBody = req.body && Array.isArray(req.body) && req.body.length > 0;

    if (!hasBody) {
      return res.status(400).json({ error: 'Forneça uma lista de vínculos no corpo da requisição' });
    }

    const parsedBody = updatePermissionsSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.success === false ? parsedBody.error.errors : [] }
);
    }

    const vinculos = parsedBody.data;
    const errors: { index: number; message: string }[] = [];
    const vinculosAtualizados: any[] = [];

    for (let i = 0; i < vinculos.length; i++) {
      const { idPropriedade, idUsuario, permissao } = vinculos[i];

      const vinculoExistente = await prisma.usuariosPropriedades.findUnique({
        where: {
          idUsuario_idPropriedade: {
            idUsuario,
            idPropriedade,
          },
        },
      });

      if (!vinculoExistente) {
        errors.push({
          index: i,
          message: `Vínculo entre usuário ${idUsuario} e propriedade ${idPropriedade} não encontrado`,
        });
        continue;
      }

      const vinculoAtualizado = await prisma.usuariosPropriedades.update({
        where: {
          idUsuario_idPropriedade: {
            idUsuario,
            idPropriedade,
          },
        },
        data: {
          permissao,
          updatedAt: new Date(),
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

      vinculosAtualizados.push({
        id: vinculoAtualizado.id,
        idUsuario: vinculoAtualizado.idUsuario,
        idPropriedade: vinculoAtualizado.idPropriedade,
        permissao: vinculoAtualizado.permissao,
        dataVinculo: vinculoAtualizado.dataVinculo,
        usuario: vinculoAtualizado.usuario,
        propriedade: vinculoAtualizado.propriedade,
      });
    }

    if (errors.length > 0 && vinculosAtualizados.length === 0) {
      return res.status(400).json({ error: errors });
  }

    return res.status(200).json(vinculosAtualizados);
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export { updateUserPermission };