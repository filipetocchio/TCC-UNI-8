// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Listagem Paginada de TODAS as Fotos de Propriedades (Administrativo)
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint administrativo que recupera uma
 * lista paginada de TODAS as fotos de TODAS as propriedades do sistema.
 *
 * ####################################################################
 * #                                                                  #
 * #   N O T A   D E   S E GUR A N Ç A   E   R O T E A M E N T O    #
 * #                                                                  #
 * ####################################################################
 *
 * Este controlador expõe dados de todas as fotos. É CRUCIAL que a rota que
 * o utiliza seja configurada com middlewares `protect` e `verifyRoles` para
 * garantir que apenas usuários com nível de **Administrador** possam acessá-la.
 *
 * Exemplo no arquivo de rotas:
 * router.get('/photos', protect, verifyRoles(ROLES_LIST.Admin), getPropertyPhoto);
 *
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'photoAccess.log';

// Schema para validar os parâmetros de paginação da query string.
const getPhotosSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0),
});

/**
 * Processa a requisição para buscar todas as fotos de propriedades com paginação.
 */
export const getPropertyPhoto = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    // A autorização final (nível de acesso de admin) deve ser garantida na definição da rota.
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário não autenticado.' });
    }

    const { limit, page } = getPhotosSchema.parse(req.query);

    // --- 2. Execução das Consultas Paginadas em Transação ---
    const skip = (page - 1) * limit;
    const where: Prisma.FotoPropriedadeWhereInput = {}; // Filtro vazio para buscar todas.

    const [totalRecords, fotos] = await prisma.$transaction([
      prisma.fotoPropriedade.count({ where }),
      prisma.fotoPropriedade.findMany({
        where,
        include: {
          propriedade: {
            select: {
              id: true,
              nomePropriedade: true,
            },
          },
        },
        skip,
        take: limit,
      }),
    ]);

    // --- 3. Construção das URLs Absolutas das Fotos ---
    const domain = `${req.protocol}://${req.get('host')}`;
    const fotosComUrlCompleta = fotos.map(foto => ({
      ...foto,
      // Mapeia o campo 'documento' para 'url' para consistência com o frontend.
      url: `${domain}${foto.documento}`,
    }));

    // --- 4. Cálculo da Paginação e Envio da Resposta ---
    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
      success: true,
      message:
        fotos.length > 0
          ? 'Fotos recuperadas com sucesso.'
          : 'Nenhuma foto encontrada.',
      data: fotosComUrlCompleta,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar todas as fotos: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar as fotos.',
    });
  }
};