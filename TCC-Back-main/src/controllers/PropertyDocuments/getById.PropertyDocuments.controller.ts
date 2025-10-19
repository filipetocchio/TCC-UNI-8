// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Busca de Documento de Propriedade por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera os detalhes de um
 * documento de propriedade específico, identificado pelo seu ID.
 *
 * A consulta é segura e otimizada, garantindo em uma única operação que:
 * 1.  Apenas usuários autenticados possam acessar o endpoint.
 * 2.  Apenas membros da propriedade à qual o documento pertence possam visualizá-lo.
 * 3.  A URL do documento retornada seja absoluta e pronta para consumo.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'documentAccess.log';

// Schema para validar o ID do documento recebido via parâmetros da URL.
const getDocumentByIdSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, {
    message: 'O ID do documento é inválido.',
  }),
});

/**
 * Processa a requisição para buscar um documento específico pelo seu ID.
 */
export const getPropertyDocumentsById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;
    const { id: documentId } = getDocumentByIdSchema.parse(req.params);

    // --- 2. Busca e Autorização em uma Única Consulta (Desempenho e Segurança) ---
    // A consulta busca o documento pelo  ID e, ao mesmo tempo, verifica se
    // a propriedade associada tem o usuário requisitante como membro.
    // Isso combina a busca e a autorização em uma única chamada ao banco de dados.
    const documento = await prisma.documentoPropriedade.findFirst({
      where: {
        id: documentId,
        propriedade: {
          usuarios: {
            some: {
              idUsuario: userId,
            },
          },
        },
      },
      include: {
        propriedade: {
          select: { id: true, nomePropriedade: true },
        },
      },
    });

    // Se o resultado for nulo, significa que ou o documento não existe, ou o
    // usuário não tem permissão para vê-lo. Em ambos os casos, um 404 é retornado
    // para não vazar a informação de que o documento existe.
    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado ou acesso negado.' });
    }

    // --- 3. Construção da URL Absoluta do Documento ---
    const domain = `${req.protocol}://${req.get('host')}`;
    const documentoComUrlCompleta = {
      ...documento,
      documento: `${domain}${documento.documento}`,
    };

    // --- 4. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Documento recuperado com sucesso.',
      data: documentoComUrlCompleta,
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar documento por ID: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar o documento.',
    });
  }
};