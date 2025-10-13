// Todos direitos autorais reservados pelo QOTA.

import { Request, Response } from "express";
import { prisma } from "../../utils/prisma";
import { z } from "zod";

// Schema para validar o ID do usuário vindo dos parâmetros da rota.
const getUserPropertiesSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => val > 0, {
    message: "O ID do usuário deve ser um número positivo.",
  }),
});

// Schema para validar os parâmetros de paginação e filtro da query string.
const getQueryParamsSchema = z.object({
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  showDeleted: z.enum(["true", "false", "only"]).optional().default("false"),
});

/**
 * Busca e retorna uma lista paginada de propriedades associadas a um usuário específico.
 * @param req - O objeto de requisição do Express.
 * @param res - O objeto de resposta do Express.
 */
export const getPropertiesByUser = async (req: Request, res: Response) => {
  try {
    const { id: userId } = getUserPropertiesSchema.parse(req.params);
    const { limit, page, showDeleted } = getQueryParamsSchema.parse(req.query);

    // Valida se o usuário existe no sistema.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Usuário não encontrado." });
    }

    // Define o filtro para propriedades ativas ou excluídas.
    const deletedFilter =
      showDeleted === "false"
        ? { excludedAt: null }
        : showDeleted === "only"
        ? { excludedAt: { not: null } }
        : {};

    const whereClause = {
      idUsuario: userId,
      propriedade: deletedFilter,
    };

    // Realiza a contagem e a busca dos dados em paralelo para otimizar a performance.
    const [totalRecords, userLinks] = await prisma.$transaction([
      prisma.usuariosPropriedades.count({ where: whereClause }),
      prisma.usuariosPropriedades.findMany({
        where: whereClause,
        include: {
          propriedade: {
            include: {
              fotos: {
                select: { documento: true }, // Seleciona apenas a URL do documento.
                take: 1, // Pega apenas a primeira foto como principal.
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    
    // Formata os dados para um formato mais limpo e adequado para o frontend.
    const formattedProperties = userLinks.map((link) => ({
      id: link.propriedade.id,
      nomePropriedade: link.propriedade.nomePropriedade,
      tipo: link.propriedade.tipo,
      // Constrói a URL completa da imagem para facilitar o consumo no frontend.
      imagemPrincipal: link.propriedade.fotos[0]?.documento 
        ? `${req.protocol}://${req.get('host')}${link.propriedade.fotos[0].documento}`
        : null,
      permissao: link.permissao, // Inclui a permissão do usuário naquela propriedade.
    }));

    return res.status(200).json({
      success: true,
      message: "Propriedades do usuário recuperadas com sucesso.",
      data: formattedProperties,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    console.error("Erro ao buscar propriedades do usuário:", error);
    return res.status(500).json({ success: false, message: "Erro interno no servidor." });
  }
};