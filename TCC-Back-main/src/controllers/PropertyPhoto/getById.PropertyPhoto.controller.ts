// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Busca de Foto de Propriedade por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que recupera os detalhes de uma
 * foto de propriedade específica, identificada pelo seu ID.
 *
 * O processo é seguro e garante que:
 * 1.  Apenas usuários autenticados possam acessar o endpoint.
 * 2.  Apenas membros da propriedade à qual a foto pertence possam visualizá-la.
 * 3.  A URL da foto retornada seja absoluta e pronta para consumo.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'photoAccess.log';

// Schema para validar o ID da foto recebido via parâmetros da URL.
const getPhotoByIdSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, {
    message: 'O ID da foto deve ser um número inteiro positivo.',
  }),
});

/**
 * Processa a requisição para buscar uma foto de propriedade específica pelo seu ID.
 */
export const getPropertyPhotoById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId } = req.user;
    const { id: photoId } = getPhotoByIdSchema.parse(req.params);

    // --- 2. Busca da Foto ---
    const foto = await prisma.fotoPropriedade.findUnique({
      where: { id: photoId },
      include: {
        propriedade: {
          select: { id: true, nomePropriedade: true },
        },
      },
    });

    if (!foto) {
      return res.status(404).json({ success: false, message: 'Foto não encontrada.' });
    }

    // --- 3. Verificação de Autorização (Membro da Propriedade) ---
    const userPermission = await prisma.usuariosPropriedades.findFirst({
      where: {
        idPropriedade: foto.idPropriedade,
        idUsuario: userId,
      },
    });

    if (!userPermission) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Você não é membro da propriedade desta foto.',
      });
    }

    // --- 4. Construção da URL Absoluta e Formatação da Resposta ---
    const domain = `${req.protocol}://${req.get('host')}`;
    const responseData = {
      ...foto,
      // Mapeia o campo 'documento' para 'url' para consistência com o frontend.
      url: `${domain}${foto.documento}`,
    };

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Foto recuperada com sucesso.',
      data: responseData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    // Em produção, este erro deve ser registrado em um sistema de monitoramento.
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO ao buscar foto por ID: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao buscar a foto.',
    });
  }
};