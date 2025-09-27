/**
 * @file update.Permission.controller.ts
 * @description Controller para a atualização da permissão de um único vínculo
 * entre um usuário e uma propriedade.
 */
// Todos direitos autorais reservados pelo QOTA.


import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * @name updatePermissionSchema
 * @description Valida o corpo da requisição para garantir que a nova permissão
 * seja um dos valores permitidos no sistema.
 */
const updatePermissionSchema = z.object({
  permissao: z.enum(['proprietario_master', 'proprietario_comum']),
});

/**
 * @function updatePermission
 * @async
 * @description Manipula a requisição para alterar a permissão de um membro da propriedade.
 * @param {Request} req - O objeto de requisição do Express.
 * @param {Response} res - O objeto de resposta do Express.
 * @returns {Promise<Response>} Retorna uma resposta JSON indicando sucesso ou falha.
 */
export const updatePermission = async (req: Request, res: Response) => {
  try {
    // 1. Validação dos Dados de Entrada e Autenticação
    const { id: usuariosPropriedadesId } = req.params;
    const { permissao: novaPermissao } = updatePermissionSchema.parse(req.body);

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const idUsuarioRequisitante = req.user.id;

    // 2. Busca do Vínculo Alvo
    const vinculo = await prisma.usuariosPropriedades.findUnique({
      where: { id: Number(usuariosPropriedadesId) },
    });

    if (!vinculo) {
      return res.status(404).json({ success: false, message: "Vínculo de membro não encontrado." });
    }
    const { idPropriedade } = vinculo;

    // 3. Verificação de Autorização (Regra de Negócio)
    // Garante que o usuário que faz a requisição é um 'proprietario_master' da propriedade em questão.
    const requisitanteIsMaster = await prisma.usuariosPropriedades.findFirst({
      where: { idUsuario: idUsuarioRequisitante, idPropriedade, permissao: 'proprietario_master' },
    });

    if (!requisitanteIsMaster) {
      return res.status(403).json({ success: false, message: "Acesso negado. Apenas proprietários master podem alterar permissões." });
    }

    // 4. Verificação de Segurança (Regra de Negócio Crítica)
    // Impede o rebaixamento do último proprietário master, o que deixaria a propriedade sem administrador.
    if (vinculo.permissao === 'proprietario_master' && novaPermissao === 'proprietario_comum') {
      const masterCount = await prisma.usuariosPropriedades.count({
        where: { idPropriedade, permissao: 'proprietario_master' },
      });

      if (masterCount <= 1) {
        return res.status(400).json({ success: false, message: "Ação bloqueada: Não é possível rebaixar o último proprietário master da propriedade." });
      }
    }

    // 5. Execução da Atualização
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
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    console.error("Erro ao atualizar permissão:", error);
    return res.status(500).json({ success: false, message: "Erro interno do servidor." });
  }
};

