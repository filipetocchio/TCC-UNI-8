/**
 * @file create.Inventory.controller.ts
 * @description Este arquivo contém o controller responsável pela criação de um novo
 * item no inventário de uma propriedade. Ele lida com a validação
 * dos dados de entrada, a verificação de regras de negócio e a
 * persistência dos dados no banco.
 */
// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';

/**
 * @name createInventoryItemSchema
 * @description Define o "contrato" de dados para a criação de um item de inventário.
 * Utiliza o Zod para garantir que qualquer dado recebido pela API esteja
 * em conformidade com as regras de negócio (tipos, formatos, valores
 * padrão) antes de ser processado.
 */
const createInventoryItemSchema = z.object({
  idPropriedade: z.number().int().positive({ message: 'O ID da propriedade é obrigatório.' }),
  nome: z.string().min(1, { message: 'O nome do item é obrigatório.' }).max(150),
  quantidade: z.number().int().positive().optional().default(1),
  estadoConservacao: z.enum(['NOVO', 'BOM', 'DESGASTADO', 'DANIFICADO']).optional().default('BOM'),
  categoria: z.string().optional(),
  dataAquisicao: z.string().datetime().optional().nullable(),
  descricao: z.string().optional().nullable(),
  valorEstimado: z.number().positive().optional().nullable(),
  codigoBarras: z.string().optional().nullable(),
});

/**
 * @function createInventoryItem
 * @async
 * @description Controller principal para manipular a requisição de criação de um item de inventário.
 * @param {Request} req - O objeto de requisição do Express.
 * @param {Response} res - O objeto de resposta do Express.
 * @returns {Promise<Response>} Retorna uma resposta JSON indicando sucesso ou falha.
 */
export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    // Etapa 1: Validação e Sanitização dos Dados
    // Garante que o corpo da requisição (req.body) adere estritamente ao schema definido.
    // Se a validação falhar, o Zod dispara um erro, que é capturado pelo bloco catch,
    // impedindo que dados malformados ou maliciosos prossigam no fluxo.
    const validatedData = createInventoryItemSchema.parse(req.body);

    // Etapa 2: Verificação de Integridade Referencial
    // Antes de criar o item, é crucial confirmar que a propriedade à qual ele
    // pertence realmente existe e está ativa (não foi soft-deletada).
    // Isso previne a criação de "itens órfãos" no sistema.
    const propertyExists = await prisma.propriedades.findFirst({
      where: {
        id: validatedData.idPropriedade,
        excludedAt: null,
      },
    });

    if (!propertyExists) {
      return res.status(404).json({
        success: false,
        message: 'Propriedade não encontrada ou está inativa.',
      });
    }

    // Etapa 3: Persistência dos Dados
    // Ocorre a criação do novo registro no banco de dados. O objeto `data` é
    // montado de forma explícita para o Prisma, garantindo máxima clareza e
    // segurança de tipos. A relação com a propriedade é estabelecida através do
    // aninhamento `propriedade: { connect: { id: ... } }`, que é a forma
    // idiomática e segura do Prisma para vincular registros existentes.
    const newItem = await prisma.itemInventario.create({
      data: {
        // Mapeamento dos campos do item
        nome: validatedData.nome,
        quantidade: validatedData.quantidade,
        estadoConservacao: validatedData.estadoConservacao,
        categoria: validatedData.categoria,
        descricao: validatedData.descricao,
        valorEstimado: validatedData.valorEstimado,
        codigoBarras: validatedData.codigoBarras,
        dataAquisicao: validatedData.dataAquisicao ? new Date(validatedData.dataAquisicao) : null,
        
        // Estabelecimento da relação com a entidade 'Propriedades'
        propriedade: {
          connect: {
            id: validatedData.idPropriedade,
          },
        },
      },
    });

    // Etapa 4: Resposta de Sucesso
    // Finaliza o fluxo com uma resposta HTTP 201 (Created), que é o padrão para
    // criações bem-sucedidas. O corpo da resposta retorna o objeto recém-criado,
    // permitindo que o front-end atualize seu estado sem novas requisições.
    return res.status(201).json({
      success: true,
      message: `Item "${newItem.nome}" adicionado ao inventário com sucesso.`,
      data: newItem,
    });

  } catch (error) {
    // Bloco de Tratamento de Erros Centralizado
    // Se o erro for uma instância de ZodError, a requisição foi malformada (400 Bad Request).
    // Para todos os outros casos (ex: falha de banco), um erro genérico 500 é retornado
    // para não expor detalhes da infraestrutura, enquanto o erro real é logado no servidor.
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors[0].message });
    }
    
    console.error('Erro ao criar item de inventário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
  }
};