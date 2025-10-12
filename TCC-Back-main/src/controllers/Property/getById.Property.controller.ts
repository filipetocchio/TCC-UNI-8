// Todos direitos autorais reservados pelo QOTA.

import { prisma } from '../../utils/prisma';
import { Request, Response } from "express";
import { z } from "zod";

// Schema para validação do parâmetro de ID da rota.
const getPropertyByIdSchema = z.object({
  id: z.string().transform(val => parseInt(val, 10))
    .refine(val => val > 0, { message: "O ID da propriedade é inválido." }),
});

/**
 * Controller para buscar os detalhes completos de uma propriedade específica por seu ID.
 */
export const getPropertyById = async (req: Request, res: Response) => {
  try {
    const { id } = getPropertyByIdSchema.parse(req.params);

    // Busca a propriedade e inclui seletivamente os dados relacionados essenciais.
    const property = await prisma.propriedades.findUnique({
      where: { id },
      select: {
        id: true,
        nomePropriedade: true,
        tipo: true,
        dataCadastro: true,
        valorEstimado: true,
        enderecoCep: true,
        enderecoCidade: true,
        enderecoBairro: true,
        enderecoLogradouro: true,
        enderecoNumero: true,
        enderecoComplemento: true,
        enderecoPontoReferencia: true,
        duracaoMinimaEstadia: true,
        duracaoMaximaEstadia: true,
        horarioCheckin: true,
        horarioCheckout: true,
        prazoCancelamentoReserva: true,
        limiteFeriadosPorCotista: true,     
        limiteReservasAtivasPorCotista: true, 

        fotos: {
          select: { id: true, documento: true },
          where: { excludedAt: null }
        },
        documentos: {
          select: { id: true, tipoDocumento: true, documento: true },
          where: { excludedAt: null }
        },
        usuarios: {
          where: { usuario: { excludedAt: null } },
          select: {
            id: true, // ID do vínculo (UsuariosPropriedades)
            permissao: true,
            porcentagemCota: true,
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
        message: error.issues[0].message,
      });
    }
    return res.status(500).json({ success: false, message: "Erro interno do servidor ao buscar a propriedade." });
  }
};