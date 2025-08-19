import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import { z } from "zod";

const getPropertyByIdSchema = z.object({
  id: z
    .string()
    .transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: "ID must be a positive number." }),
});

const getPropertyById = async (req: Request, res: Response) => {
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
        documento: true,
        dataCadastro: true,
        usuarios: {
          select: {
            usuario: { select: { id: true, nomeCompleto: true } },
            permissao: true,
          },
        },
        fotos: {
          select: { id: true, documento: true },
        },
        documentos: {
          select: { id: true, tipoDocumento: true, documento: true },
        },
      },
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: "Propriedade não encontrada.",
        message: "Propriedade não encontrada.",
      });
    }

    const formattedProperty = {
      ...property,
      usuarios: property.usuarios.map(u => ({
        id: u.usuario.id,
        nomeCompleto: u.usuario.nomeCompleto,
        permissao: u.permissao,
      })),
      fotos: property.fotos,
      documentos: property.documentos,
    };

    return res.status(200).json({
      success: true,
      message: "Propriedade recuperada com sucesso.",
      data: formattedProperty,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        message: error.errors[0].message,
      });
    }
    console.error("Erro no getPropertyById:", error);
    return res.status(500).json({
      success: false,
      error: "Erro interno do servidor.",
      message: error instanceof Error ? error.message : "Erro interno do servidor.",
    });
  }
};

export { getPropertyById };