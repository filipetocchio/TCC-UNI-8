import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

// Schema Zod para validar o body da requisição
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

const createProperty = async (req: Request, res: Response) => {
  try {
    // 1) Validação do body
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

    console.log('Iniciando criação de propriedade para usuário:', userId);

    // 2) Verifica existência do usuário
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log('Usuário encontrado:', user);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    // 3) Verifica se usuário está ativo
    console.log('User excludedAt:', user.excludedAt);
    if (user.excludedAt) {
      return res.status(400).json({ success: false, error: `Usuário desativado (ID: ${userId}).` });
    }

    // 4) Cria propriedade e vínculo em transação
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
      console.log('Propriedade criada:', property);

      const link = await tx.usuariosPropriedades.create({
        data: {
          idUsuario: userId,
          idPropriedade: property.id,
          permissao: 'proprietario_master',
        },
      });
      console.log('Vínculo criado:', link);

      return { property, link };
    });

    // 5) Retorna resposta de sucesso
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
    console.error('Erro em createProperty:', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.errors[0].message });
    }
    return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
  }
};

export { createProperty };
