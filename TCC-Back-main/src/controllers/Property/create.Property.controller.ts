// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * Schema para validação dos dados de entrada para criação de uma nova propriedade.
 */
const createPropertySchema = z.object({
  nomePropriedade: z.string().min(1, { message: "O nome da propriedade é obrigatório." }).max(100),
  tipo: z.enum(['Casa', 'Apartamento', 'Chacara', 'Lote', 'Outros']),
  userId: z.number().int().positive({ message: "A ID do usuário criador é inválida." }),
  enderecoCep: z.string().optional(),
  enderecoCidade: z.string().optional(),
  enderecoBairro: z.string().optional(),
  enderecoLogradouro: z.string().optional(),
  enderecoNumero: z.string().optional(),
  enderecoComplemento: z.string().optional(),
  enderecoPontoReferencia: z.string().optional(),
  valorEstimado: z.number().positive().optional().nullable(),
 
});

/**
 * Controller para criar uma nova propriedade e vincular o usuário criador
 * como proprietário master, atribuindo a ele 100% da cota da propriedade.
 */
export const createProperty = async (req: Request, res: Response) => {
  try {
    const { userId, ...propertyData } = createPropertySchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário criador não encontrado.' });
    }

    // A criação da propriedade e do vínculo do usuário ocorre de forma aninhada
    // para garantir a consistência e atomicidade da operação.
    const newProperty = await prisma.propriedades.create({
      data: {
        ...propertyData,
        usuarios: {
          create: [
            {
              idUsuario: userId,
              permissao: 'proprietario_master',
              porcentagemCota: 100,
            },
          ],
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: `Propriedade "${newProperty.nomePropriedade}" criada com sucesso.`,
      data: {
        id: newProperty.id,
        nomePropriedade: newProperty.nomePropriedade,
        tipo: newProperty.tipo,
        dataCadastro: newProperty.dataCadastro,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    
    // Para erros inesperados, retorna uma mensagem genérica por segurança.
    console.error("Erro não tratado ao criar propriedade:", error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao criar a propriedade.' });
  }
};