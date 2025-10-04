// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const updatePermissionSchema = z.object({
  permissao: z.enum(['proprietario_master', 'proprietario_comum']),
});

export const updatePermission = async (req: Request, res: Response) => {
  try {
    const { id: usuariosPropriedadesId } = req.params;
    const { permissao: novaPermissao } = updatePermissionSchema.parse(req.body);

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const idUsuarioRequisitante = req.user.id;

    const vinculo = await prisma.usuariosPropriedades.findUnique({
      where: { id: Number(usuariosPropriedadesId) },
    });

    if (!vinculo) {
      return res.status(404).json({ success: false, message: "Vínculo de membro não encontrado." });
    }
    const { idPropriedade } = vinculo;

    const requisitanteIsMaster = await prisma.usuariosPropriedades.findFirst({
      where: { idUsuario: idUsuarioRequisitante, idPropriedade, permissao: 'proprietario_master' },
    });

    if (!requisitanteIsMaster) {
      return res.status(403).json({ success: false, message: "Acesso negado. Apenas proprietários master podem alterar permissões." });
    }

    if (vinculo.permissao === 'proprietario_master' && novaPermissao === 'proprietario_comum') {
      const masterCount = await prisma.usuariosPropriedades.count({
        where: { idPropriedade, permissao: 'proprietario_master' },
      });

      if (masterCount <= 1) {
        return res.status(400).json({ success: false, message: "Ação bloqueada: Não é possível rebaixar o último proprietário master da propriedade." });
      }
    }

    const vinculoAtualizado = await prisma.usuariosPropriedades.update({
      where: { id: Number(usuariosPropriedadesId) },
      data: { permissao: novaPermissao },
    });

    return res.status(200).json({
      success: true,
      message: "Permissão atualizada com sucesso.",
      data: vinculoAtualizado,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error("Erro ao atualizar permissão:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};