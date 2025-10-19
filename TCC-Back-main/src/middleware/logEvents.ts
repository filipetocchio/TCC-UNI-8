// Todos direitos autorais reservados pelo QOTA.

/**
 * Módulo de Logging de Eventos
 *
 * Descrição:
 * Este arquivo fornece a infraestrutura central de logging para a aplicação.
 * Ele exporta duas funções principais:
 *
 * 1.  `logEvents`: Uma função utilitária que formata uma mensagem de log com
 * data, hora, um UUID único e a mensagem em si, e a anexa a um arquivo de log
 * especificado. Ela também cria o diretório de logs, se necessário.
 *
 * 2.  `logger`: Um middleware do Express que utiliza `logEvents` para registrar
 * informações básicas sobre cada requisição recebida pela API (método, origem e URL).
 */
import { format } from 'date-fns';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

/**
 * Formata e escreve uma mensagem de log em um arquivo especificado.
 * @param message A mensagem a ser registrada.
 * @param logName O nome do arquivo de log (ex: 'reqLog.txt', 'errLog.txt').
 */
export const logEvents = async (message: string, logName: string) => {
  // --- 1. Formatação do Item de Log ---
  // Cria uma entrada de log padronizada com data, hora, um ID único e a mensagem.
  const dateTime = `${format(new Date(), 'yyyyMMdd\tHH:mm:ss')}`;
  const logItem = `${dateTime}\t${uuid()}\t${message}\n`;

  // --- 2. Definição do Diretório de Logs ---
  // Utiliza o diretório definido na variável de ambiente ou um padrão.
  const logsDir = process.env.LOGS_DIR || path.join(__dirname, '..', 'logs');

  try {
    // --- 3. Escrita do Log no Arquivo ---
    // Verifica se o diretório de logs existe; se não, cria-o recursivamente.
    if (!fs.existsSync(logsDir)) {
      await fsPromises.mkdir(logsDir, { recursive: true });
    }
    // Anexa a nova entrada de log ao final do arquivo especificado.
    await fsPromises.appendFile(path.join(logsDir, logName), logItem);
  } catch (err) {
    // NOTA: Este é o único local onde `console.error` é intencional. Se o próprio
    // sistema de logging falhar, ele precisa reportar o erro no console como
    // um último recurso.
    console.error('Falha crítica ao gravar no arquivo de log:', err);
  }
};

/**
 * Middleware do Express para registrar todas as requisições recebidas.
 */
export const logger = (req: Request, res: Response, next: NextFunction) => {
  // Monta a mensagem de log com os detalhes da requisição.
  const message = `${req.method}\t${req.headers.origin || 'origem_desconhecida'}\t${
    req.url
  }`;
  
  // Utiliza a função 'logEvents' para salvar o log no arquivo 'reqLog.txt'.
  logEvents(message, 'reqLog.txt');
  
  // Passa o controle para o próximo middleware na cadeia.
  next();
};