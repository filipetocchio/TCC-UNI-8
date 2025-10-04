// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

const updatePropertySchema = z.object({
  nomePropriedade: z.string().min(1, { message: 'O nome da propriedade é obrigatório.' }).optional(),
  enderecoCep: z.string().optional().refine(val => !val || /^\d{8}$/.test(val), { message: 'O CEP deve ter 8 dígitos.' }),
  enderecoCidade: z.string().optional(),
  enderecoBairro: z.string().optional(),
  enderecoLogradouro: z.string().optional(),
  enderecoNumero: z.string().optional(),
  enderecoComplemento: z.string().optional(),
  enderecoPontoReferencia: z.string().optional(),
  tipo: z.enum(['Casa', 'Apartamento', 'Chacara', 'Lote', 'Outros']).optional(),
  valorEstimado: z.number().positive({ message: 'O valor estimado deve ser positivo.' }).optional(),
  documento: z.string().optional(),
  propertyId: z.number().int().positive({ message: 'ID da propriedade inválido.' }),
});

export const updateProperty = async (req: Request, res: Response) => {
  try {
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
      propertyId,
    } = updatePropertySchema.parse({
      ...req.body,
      propertyId: parseInt(req.params.id),
    });

    const property = await prisma.propriedades.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Propriedade não encontrada.',
      });
    }

    if (property.excludedAt) {
      return res.status(400).json({
        success: false,
        message: 'Propriedade já foi deletada.',
      });
    }

    const updateData: any = {};
    if (nomePropriedade) updateData.nomePropriedade = nomePropriedade;
    if (enderecoCep !== undefined) updateData.enderecoCep = enderecoCep;
    if (enderecoCidade !== undefined) updateData.enderecoCidade = enderecoCidade;
    if (enderecoBairro !== undefined) updateData.enderecoBairro = enderecoBairro;
    if (enderecoLogradouro !== undefined) updateData.enderecoLogradouro = enderecoLogradouro;
    if (enderecoNumero !== undefined) updateData.enderecoNumero = enderecoNumero;
    if (enderecoComplemento !== undefined) updateData.enderecoComplemento = enderecoComplemento;
    if (enderecoPontoReferencia !== undefined) updateData.enderecoPontoReferencia = enderecoPontoReferencia;
    if (tipo) updateData.tipo = tipo;
    if (valorEstimado !== undefined) updateData.valorEstimado = valorEstimado;
    if (documento !== undefined) updateData.documento = documento;

    const updatedProperty = await prisma.propriedades.update({
      where: { id: propertyId },
      data: updateData,
      select: {
        id: true,
        nomePropriedade: true,
        enderecoCep: true,
        enderecoCidade: true,
        enderecoBairro: true,
        enderecoLogradouro: true,
        enderecoNumero: true,
        enderecoComplemento: true,
        enderecoPontoReferencia: true,
        tipo: true,
        valorEstimado: true,
        documento: true,
        dataCadastro: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Propriedade atualizada com sucesso.',
      data: updatedProperty,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.issues[0].message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor.',
    });
  }
};