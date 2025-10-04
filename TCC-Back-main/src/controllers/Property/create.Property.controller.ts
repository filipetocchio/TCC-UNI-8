// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const createPropertySchema = z.object({
  nomePropriedade: z.string().min(1).max(100),
  enderecoCep: z.string().optional().refine(val => !val || /^\d{8}$/.test(val), { message: 'O CEP deve ter 8 dígitos.' }),
  enderecoCidade: z.string().optional(),
  enderecoBairro: z.string().optional(),
  enderecoLogradouro: z.string().optional(),
  enderecoNumero: z.string().optional(),
  enderecoComplemento: z.string().optional(),
  enderecoPontoReferencia: z.string().optional(),
  tipo: z.enum(['Casa', 'Apartamento', 'Chacara', 'Lote', 'Outros']),
  valorEstimado: z.number().positive().optional(),
  documento: z.string().optional(),
  userId: z.number().int().positive(),
});

export const createProperty = async (req: Request, res: Response) => {
  try {
    const data = createPropertySchema.parse(req.body);
    const {
      nomePropriedade,
      enderecoCep,
      enderecoCidade,
      enderecoBairro,
      enderecoLogradouro,
      enderecoNumero,
      enderecoComplemento,
      enderecoPontoReferencia,
      tipo,
      valorEstimado,
      documento,
      userId,
    } = data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    if (user.excludedAt) {
      return res.status(400).json({ success: false, message: `Usuário desativado (ID: ${userId}).` });
    }

    const result = await prisma.$transaction(async (tx) => {
      const property = await tx.propriedades.create({
        data: {
          nomePropriedade,
          enderecoCep,
          enderecoCidade,
          enderecoBairro,
          enderecoLogradouro,
          enderecoNumero,
          enderecoComplemento,
          enderecoPontoReferencia,
          tipo,
          valorEstimado,
          documento,
        },
      });

      const link = await tx.usuariosPropriedades.create({
        data: {
          idUsuario: userId,
          idPropriedade: property.id,
          permissao: 'proprietario_master',
        },
      });

      return { property, link };
    });

    const { property } = result;
    return res.status(201).json({
      success: true,
      message: `Propriedade "${property.nomePropriedade}" criada com sucesso.`,
      data: {
        id: property.id,
        nomePropriedade: property.nomePropriedade,
        tipo: property.tipo,
        dataCadastro: property.dataCadastro,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: err.issues[0].message });
    }
    console.error('Erro em createProperty:', err);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};