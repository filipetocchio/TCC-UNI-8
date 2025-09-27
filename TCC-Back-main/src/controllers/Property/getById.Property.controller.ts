/**
 * @file getById.Property.controller.ts
 * @description Controller para buscar os detalhes completos de uma propriedade específica.
 */
// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import { z } from "zod";

/**
 * @name getPropertyByIdSchema
 * @description Valida que o parâmetro 'id' da rota é um número positivo.
 */
const getPropertyByIdSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: "O ID da propriedade deve ser um número positivo." }),
});

export const getPropertyById = async (req: Request, res: Response) => {
  try {
    const { id } = getPropertyByIdSchema.parse(req.params);

    const property = await prisma.propriedades.findUnique({
      where: { id },
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
        dataCadastro: true,
        fotos: {
          select: { id: true, documento: true },
          where: { excludedAt: null }
        },
        documentos: {
          select: { id: true, tipoDocumento: true, documento: true },
          where: { excludedAt: null }
        },
        // Estrutura de dados completa para os membros
        usuarios: {
          where: { usuario: { excludedAt: null } },
          select: {
            id: true, // ID do vínculo (UsuariosPropriedades)
            permissao: true,
            usuario: {
              select: {
                id: true, // ID do usuário
                nomeCompleto: true,
                email: true,
              }
            }
          }
        }
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Propriedade não encontrada.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Propriedade recuperada com sucesso.",
      data: property,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    console.error("Erro no getPropertyById:", error);
    // Tratamento de erro seguro
    const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor.",
      error: errorMessage,
    });
  }
};
