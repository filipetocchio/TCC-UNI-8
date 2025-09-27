// Todos direitos autorais reservados pelo QOTA.

import express from 'express';
import { apiV1Router } from './routes/routes';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './middleware/logEvents';
import cors from 'cors';
import { corsOptions } from './config/corsOptions';
import cookieParser from 'cookie-parser';

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

// Tratamento de erros
app.use(errorHandler);

// Inicia o servidor
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});