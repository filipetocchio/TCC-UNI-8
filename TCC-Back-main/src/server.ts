// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import { apiV1Router } from './routes/routes';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logEvents';
import cors from 'cors';
import { corsOptions } from './config/corsOptions';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { runUpdateOverdueExpensesJob } from './jobs/updateOverdueExpenses.job';
import { runCreateRecurringExpensesJob } from './jobs/createRecurringExpenses.job';

const app = express();
const PORT = process.env.PORT || 8001;

// Middlewares globais
app.set('json spaces', 2);
app.use(logger);
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.resolve(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/uploads/profile', express.static(path.join(__dirname, '../uploads/profile')));
app.use('/uploads/inventory', express.static(path.join(__dirname, '../uploads/inventory'))); 


// Rotas
app.use("/api/v1", apiV1Router);

app.get("/", (req, res) => {
  res.send("Hello nodejs!");
});


// --- AGENDADOR DE TAREFAS (CRON JOB) ---
console.log('[Cron] Agendador de tarefas inicializado.');

// Agenda a tarefa para rodar todos os dias à 1:00 da manhã.
// O formato é: (minuto hora dia-do-mês mês dia-da-semana)
cron.schedule('0 1 * * *', () => {
    console.log('[Cron] Executando a tarefa diária de verificação de despesas vencidas...');
    // Executa a função do job e captura qualquer erro que possa ocorrer.
    runUpdateOverdueExpensesJob().catch(error => {
        console.error('[Cron] Erro ao executar o job de despesas vencidas:', error);
    });
}, {
    timezone: "America/Sao_Paulo" 
});

// Roda todos os dias às 2:00 da manhã para criar despesas recorrentes.
cron.schedule('0 2 * * *', () => {
    console.log('[Cron] Executando job de despesas recorrentes...');
    runCreateRecurringExpensesJob().catch(error => {
        console.error('[Cron] Erro no job de despesas recorrentes:', error);
    });
}, {
    timezone: "America/Sao_Paulo"
});


// Tratamento de erros
app.use(errorHandler);

// Inicia o servidor
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});