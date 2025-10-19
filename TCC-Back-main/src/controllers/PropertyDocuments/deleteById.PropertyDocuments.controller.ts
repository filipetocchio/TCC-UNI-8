// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão de Documento de Propriedade por ID
 *
 * Descrição:
 * Este arquivo contém a lógica para a exclusão permanente de um documento. A
 * operação é segura e otimizada para performance.
 *
 * O processo é responsável por:
 * 1.  Validar a autenticação e autorização do usuário (se é 'proprietario_master').
 * 2.  Excluir o arquivo físico correspondente do disco do servidor.
 * 3.  Remover o registro do documento do banco de dados.
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
const LOG_FILE = 'documentDeletion.log';

// Schema para validar o ID do documento recebido via parâmetros da URL.
const deleteDocumentByIdSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val) && val > 0, {
    message: 'O ID do documento deve ser um número inteiro positivo.',
  }),
});

/**
 * Processa a exclusão permanente de um documento de propriedade.
 */
export const deletePropertyDocumentsById = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Validação de Entrada ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }
    const { id: userId, nomeCompleto: userName } = req.user;
    const { id: documentId } = deleteDocumentByIdSchema.parse(req.params);

    // --- 2. Busca do Documento ---
    const documento = await prisma.documentoPropriedade.findUnique({
      where: { id: documentId },
      include: { propriedade: { select: { nomePropriedade: true } } },
    });

    if (!documento) {
      return res.status(404).json({ success: false, message: `Documento não encontrado.` });
    }

    // --- 3. Verificação de Autorização (Regra de Negócio) ---
    // Garante que o usuário que está fazendo a requisição é um 'proprietario_master'.
    const userPermission = await prisma.usuariosPropriedades.findFirst({
        where: {
            idPropriedade: documento.idPropriedade,
            idUsuario: userId,
            permissao: 'proprietario_master'
        }
    });

    if (!userPermission) {
        return res.status(403).json({ success: false, message: 'Acesso negado. Apenas proprietários master podem excluir documentos.' });
    }

    // --- 4. Exclusão do Arquivo Físico ---
    const filePath = path.join(__dirname, '../../../', documento.documento);
    try {
      await fs.unlink(filePath);
    } catch (fileError: any) {
      if (fileError.code !== 'ENOENT') {
        logEvents(`Falha ao excluir o arquivo físico ${filePath}: ${fileError.message}`, LOG_FILE);
      }
    }

    // --- 5. Exclusão do Registro do Banco de Dados ---
    await prisma.documentoPropriedade.delete({ where: { id: documentId } });

    // --- 6. Disparo da Notificação (Desempenho) ---
    // A notificação é disparada sem 'await' para não bloquear a resposta ao usuário.
    createNotification({
      idPropriedade: documento.idPropriedade,
      idAutor: userId,
      mensagem: `O usuário '${userName}' removeu o documento '${documento.tipoDocumento}' da propriedade '${documento.propriedade.nomePropriedade}'.`,
    }).catch(err => {
        logEvents(`Falha ao criar notificação para exclusão de documento: ${err.message}`, LOG_FILE);
    });

    // --- 7. Envio da Resposta de Sucesso ---
    return res.status(200).json({ success: true, message: 'O documento foi excluído com sucesso.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: error.issues[0].message });
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO CRÍTICO ao excluir documento: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao excluir o documento.',
    });
  }
};