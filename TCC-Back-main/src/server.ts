// Todos direitos autorais reservados pelo QOTA.

/**
 * Ponto de Entrada da Aplicação (Entry Point)
 *
 * Descrição:
 * Este é o arquivo principal que inicializa e configura o servidor Express.
 * Ele é responsável por:
 * 1.  Instanciar a aplicação Express.
 * 2.  Configurar e registrar todos os middlewares globais (logger, CORS, JSON parser, etc.).
 * 3.  Definir as rotas estáticas para servir arquivos como imagens da pasta 'uploads'.
 * 4.  Registrar o roteador principal da API.
 * 5.  Configurar e iniciar as tarefas agendadas (cron jobs).
 * 6.  Registrar o middleware de tratamento de erros.
 * 7.  Iniciar o servidor para escutar as requisições na porta configurada.
 */
import express from 'express';
import { apiV1Router } from './routes/routes';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { logEvents, logger } from './middleware/logEvents';
import cors from 'cors';
import { corsOptions } from './config/corsOptions';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { runUpdateOverdueExpensesJob } from './jobs/updateOverdueExpenses.job';
import { runCreateRecurringExpensesJob } from './jobs/createRecurringExpenses.job';
import { runResetDailyBalancesJob } from './jobs/resetDailyBalances.job';

// --- Inicialização da Aplicação ---
const app = express();
const PORT = process.env.PORT || 8001;

// --- Middlewares Globais ---
app.set('json spaces', 2);
app.use(logger); // Middleware para logar todas as requisições.
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Servir Arquivos Estáticos ---
// Torna a pasta 'uploads' publicamente acessível.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// --- Rotas da API ---
app.use('/api/v1', apiV1Router);
app.get('/', (req, res) => {
  res.send('Servidor QOTA em execução!');
});

// --- Agendador de Tarefas (Cron Jobs) ---
logEvents('Agendador de tarefas (cron) inicializado.', 'cron.log');

// Roda todo dia à 1:00 da manhã para atualizar despesas vencidas.
cron.schedule(
  '0 1 * * *',
  () => {
    logEvents('Executando job de verificação de despesas vencidas...', 'cron.log');
    runUpdateOverdueExpensesJob().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logEvents(`ERRO CRÍTICO no job de despesas vencidas: ${errorMessage}`, 'cron.log');
    });
  },
  { timezone: 'America/Sao_Paulo' }
);

// Roda todo dia às 2:00 da manhã para criar despesas recorrentes.
cron.schedule(
  '0 2 * * *',
  () => {
    logEvents('Executando job de criação de despesas recorrentes...', 'cron.log');
    runCreateRecurringExpensesJob().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logEvents(`ERRO CRÍTICO no job de despesas recorrentes: ${errorMessage}`, 'cron.log');
    });
  },
  { timezone: 'America/Sao_Paulo' }
);

// Roda todo ano, no dia 1º de janeiro, à meia-noite (00:00).
cron.schedule(
  '0 0 1 1 *', // Formato: (minuto hora dia-do-mês mês dia-da-semana)
  () => {
    logEvents('Executando job de renovação anual de saldo de diárias...', 'cron.log');
    runResetDailyBalancesJob().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logEvents(`ERRO CRÍTICO no job de renovação de saldos: ${errorMessage}`, 'cron.log');
    });
  },
  { timezone: 'America/Sao_Paulo' }
);

// --- Tratamento de Erros ---
// Este deve ser o último middleware a ser registrado.
app.use(errorHandler);

// --- Inicialização do Servidor ---
app.listen(PORT, () => {
  logEvents(`Servidor iniciado na porta ${PORT}`, 'server.log');
});