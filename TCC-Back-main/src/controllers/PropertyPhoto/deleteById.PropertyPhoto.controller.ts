// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão de Foto de Propriedade por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para o endpoint que realiza a exclusão permanente e
 * irreversível de uma foto específica de uma propriedade. O processo é seguro e
 * otimizado para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é master da propriedade).
 * 2.  Excluir o arquivo físico correspondente do disco do servidor.
 * 3.  Remover o registro da foto do banco de dados.
 * 4.  Disparar uma notificação em segundo plano para os membros da propriedade.
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { createNotification } from '../../utils/notification.service';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'photoDeletion.log';

// Schema para validar o ID da foto recebido via parâmetros da URL.
const deletePhotoByIdSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, {
    message: 'O ID da foto deve ser um número inteiro positivo.',
  }),
});

/**
 * Processa a exclusão permanente de uma foto de propriedade.
 */
export const deletePropertyPhotoById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { id: photoId } = deletePhotoByIdSchema.parse(req.params);

    // --- 2. Busca da Foto no Banco de Dados ---
    const foto = await prisma.fotoPropriedade.findUnique({
      where: { id: photoId },
      include: {
        propriedade: { select: { nomePropriedade: true } },
      },
    });

    if (!foto) {
      return res.status(404).json({ success: false, message: `Foto com ID ${photoId} não encontrada.` });
    }

    // --- 3. Verificação de Autorização (Segurança) ---
    // Garante que o usuário autenticado é um 'proprietario_master' da propriedade.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: foto.idPropriedade,
            idUsuario: userId,
            permissao: 'proprietario_master'
        }
    });

    if (!userPermission) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas proprietários master podem excluir fotos.'
        });
    }

    // --- 4. Exclusão do Arquivo Físico ---
    const filePath = path.join(__dirname, '../../../', foto.documento);
    try {
      await fs.unlink(filePath);
    } catch (fileError: any) {
      if (fileError.code !== 'ENOENT') {
        const logMessage = `Falha ao excluir o arquivo físico ${filePath}: ${fileError.message}`;
        logEvents(logMessage, LOG_FILE);
      }
    }

    // --- 5. Exclusão do Registro do Banco de Dados ---
    await prisma.fotoPropriedade.delete({
      where: { id: photoId },
    });

    // --- 6. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: foto.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' removeu uma foto da propriedade '${foto.propriedade.nomePropriedade}'.`,
    }).catch(err => {
        logEvents(`Falha ao criar notificação para exclusão de foto: ${err.message}`, LOG_FILE);
    });

    // --- 7. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'A foto foi excluída com sucesso.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO CRÍTICO ao excluir foto de propriedade: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao excluir a foto.',
    });
  }
};