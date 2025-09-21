import request from 'supertest';
import express from 'express';
import { apiV1Router } from '../routes/routes'; // Importando o roteador principal

// Configuração do App para o ambiente de teste
const app = express();
app.use(express.json());
app.use('/api/v1', apiV1Router);

describe('Auth Endpoints', () => {
  // Teste de sucesso para o login
  it('should allow a registered user to log in with correct credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'seu_email_de_teste@exemplo.com', // Use um usuário que exista no seu BD de teste
        password: 'sua_senha_de_teste'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('accessToken');
  });

  // Teste de falha para o login
  it('should reject login with incorrect credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'seu_email_de_teste@exemplo.com',
        password: 'senha_errada'
      });

    expect(response.status).toBe(401); // Unauthorized
    expect(response.body.success).toBe(false);
  });
});