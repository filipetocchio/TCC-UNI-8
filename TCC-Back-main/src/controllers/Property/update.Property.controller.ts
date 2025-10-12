// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { createNotification } from '../../utils/notification.service';
// Schema para os parâmetros da rota.
const paramsSchema = z.object({
    id: z.string().transform(val => parseInt(val, 10)),
});

// Schema para o corpo da requisição 
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
  
  // Utiliza o 'preprocess' para limpar o valor antes da validação.
  valorEstimado: z.preprocess(
    (val) => {
        // Se for uma string não vazia, converte para número.
        if (typeof val === 'string' && val.trim() !== '') {
            return parseFloat(val.replace(/\./g, '').replace(',', '.'));
        }
        // Se for qualquer outra coisa (null, undefined, já um número), passa adiante.
        return val;
    },
    z.number().positive({ message: 'O valor estimado deve ser um número positivo.' }).nullable().optional()
  ),
});

/**
 * Atualiza os dados de uma propriedade existente com base em seu ID.
 */
/**
 * Atualiza os dados de uma propriedade existente e notifica
 * todos os membros sobre a alteração.
 */
export const updateProperty = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
        return res.status(401).json({ success: false, message: "Usuário não autenticado." });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    
    const { id: propertyId } = paramsSchema.parse(req.params);
    const dataToUpdate = updatePropertySchema.parse(req.body);

    const property = await prisma.propriedades.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return res.status(404).json({ success: false, message: 'Propriedade não encontrada.' });
    }

    if (property.excludedAt) {
      return res.status(400).json({ success: false, message: 'Não é possível editar uma propriedade que já foi excluída.' });
    }

    const updatedProperty = await prisma.propriedades.update({
      where: { id: propertyId },
      data: dataToUpdate,
    });

    // 2. CRIA A NOTIFICAÇÃO APÓS O SUCESSO DA ATUALIZAÇÃO
    // A função é 'await' para garantir que a notificação seja criada antes de responder ao usuário.
    await createNotification({
        idPropriedade: propertyId,
        idAutor: userId,
        mensagem: `O usuário '${userName}' atualizou as informações da propriedade '${updatedProperty.nomePropriedade}'.`,
    });

    return res.status(200).json({
      success: true,
      message: 'Propriedade atualizada com sucesso.',
      data: updatedProperty,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    return res.status(500).json({ success: false, message: 'Erro interno do servidor ao atualizar a propriedade.' });
  }
};