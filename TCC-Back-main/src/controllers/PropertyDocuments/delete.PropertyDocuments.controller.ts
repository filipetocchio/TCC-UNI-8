// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão em Massa de Documentos de Propriedades
 *
 * ##########################################################################
 * #                                                                        #
 * #   A L E R T A:   O P E R A Ç Ã O   D E S T R U T I V A   E   I R R E V E R S Í V E L   #
 * #                                                                        #
 * ##########################################################################
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint administrativo que realiza a exclusão
 * em massa e permanente de TODOS os documentos de propriedades no sistema.
 *
 * A operação é otimizada para escalabilidade, utilizando uma estratégia de
 * processamento em lotes (batch processing) para evitar o consumo excessivo de
 * memória, mesmo com um volume massivo de documentos.
 *
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log e o tamanho do lote para processamento.
const LOG_FILE = 'documentDeletion.log';
const BATCH_SIZE = 100; // Processa 100 documentos de cada vez.

/**
 * Processa a exclusão permanente de todos os documentos de propriedades em lotes.
 */
export const deletePropertyDocuments = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Autorização ---
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    logEvents(`Iniciando job de exclusão em massa de documentos...`, LOG_FILE);
    let totalDeletedCount = 0;
    let hasMoreDocuments = true;

    // --- 2. Loop de Processamento em Lotes (Escalabilidade) ---
    // O loop continua enquanto houver documentos a serem processados.
    while (hasMoreDocuments) {
      // 2.1. Busca de um Lote de Documentos
      // Busca um número limitado de registros (BATCH_SIZE) para manter o uso de memória baixo.
      const batch = await prisma.documentoPropriedade.findMany({
        take: BATCH_SIZE,
      });

      // Se o lote retornado estiver vazio, significa que todos os documentos foram processados.
      if (batch.length === 0) {
        hasMoreDocuments = false;
        continue; // Encerra o loop.
      }

      // 2.2. Exclusão dos Arquivos Físicos do Lote em Paralelo (Desempenho)
      const deleteFilePromises = batch.map(documento => {
        const filePath = path.join(__dirname, '../../../', documento.documento);
        return fs.unlink(filePath).catch(err => ({ error: err, path: filePath }));
      });
      
      const fileResults = await Promise.allSettled(deleteFilePromises);
      fileResults.forEach(result => {
        if (result.status === 'rejected' && result.reason?.error?.code !== 'ENOENT') {
          logEvents(`Falha ao excluir arquivo físico ${result.reason.path}: ${result.reason.error.message}`, LOG_FILE);
        }
      });

      // 2.3. Exclusão dos Registros do Banco de Dados do Lote
      // Coleta os IDs do lote atual para a exclusão no banco.
      const idsToDelete = batch.map(doc => doc.id);
      const deleteResult = await prisma.documentoPropriedade.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });

      totalDeletedCount += deleteResult.count;
      logEvents(`Lote processado. ${deleteResult.count} registros excluídos do banco.`, LOG_FILE);
    }

    // --- 3. Envio da Resposta de Sucesso ---
    if (totalDeletedCount === 0) {
      return res.status(200).json({ success: true, message: 'Nenhum documento encontrado para excluir.' });
    }

    logEvents(`Processo concluído. Total de ${totalDeletedCount} documentos excluídos.`, LOG_FILE);
    return res.status(200).json({
      success: true,
      message: `${totalDeletedCount} documento(s) foram excluídos com sucesso.`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO CRÍTICO na exclusão em massa de documentos: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor durante a exclusão dos documentos.',
    });
  }
};