// Todos direitos autorais reservados pelo QOTA.

/**
 * Controller para Exclusão em Massa de Fotos de Propriedades
 *
 * ##########################################################################
 * #                                                                        #
 * #   A L E R T A:   O P E R A Ç Ã O   D E S T R U T I V A   E   I R R E V E R S Í V E L   #
 * #                                                                        #
 * ##########################################################################
 *
 * Descrição:
 * Este arquivo contém a lógica para um endpoint administrativo que realiza a
 * exclusão em massa e permanente de TODAS as fotos de propriedades no sistema.
 * A operação é otimizada para performance, executando a exclusão dos arquivos
 * em paralelo.
 *
 */
import { prisma } from '../../utils/prisma';
import { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { logEvents } from '../../middleware/logEvents';

// Define o nome do arquivo de log para este controlador.
const LOG_FILE = 'photoDeletion.log';

/**
 * Processa a exclusão permanente de todas as fotos de propriedades.
 */
export const deletePropertyPhoto = async (req: Request, res: Response) => {
  try {
    // --- 1. Autenticação e Autorização ---
    // A autorização final (nível de acesso de admin) deve ser garantida na definição da rota.
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuário não autenticado.' });
    }

    // --- 2. Busca de Todos os Registros de Fotos ---
    const fotos = await prisma.fotoPropriedade.findMany();

    if (fotos.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: 'Nenhuma foto encontrada para excluir.' });
    }

    logEvents(`Iniciando exclusão de ${fotos.length} arquivos de fotos.`, LOG_FILE);

    // --- 3. Exclusão dos Arquivos Físicos em Paralelo (Desempenho) ---
    // Mapeia cada exclusão de arquivo para uma promessa.
    const deletePromises = fotos.map(foto => {
      const filePath = path.join(__dirname, '../../../', foto.documento);
      return fs.unlink(filePath).catch(err => ({ error: err, path: filePath })); // Captura erros individuais
    });

    // Executa todas as promessas de exclusão em paralelo. `Promise.allSettled`
    // garante que o processo continue mesmo que a exclusão de alguns arquivos falhe.
    const results = await Promise.allSettled(deletePromises);

    // Registra quaisquer falhas que ocorreram durante a exclusão em paralelo.
    results.forEach(result => {
      if (result.status === 'rejected' && result.reason.code !== 'ENOENT') {
        const logMessage = `Falha ao excluir o arquivo físico ${result.reason.path}: ${result.reason.error.message}`;
        logEvents(logMessage, LOG_FILE);
      }
    });

    // --- 4. Exclusão dos Registros do Banco de Dados ---
    const deleteResult = await prisma.fotoPropriedade.deleteMany();

    logEvents(`${deleteResult.count} registros de fotos foram excluídos do banco de dados.`, LOG_FILE);

    // --- 5. Envio da Resposta de Sucesso ---
    return res.status(200).json({
      success: true,
      message: 'Todas as fotos foram excluídas com sucesso.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    logEvents(`ERRO CRÍTICO ao excluir fotos: ${errorMessage}\n${error instanceof Error ? error.stack : ''}`, LOG_FILE);
    
    return res.status(500).json({
      success: false,
      message: 'Ocorreu um erro inesperado no servidor ao excluir as fotos.',
    });
  }
};