Módulo: Perfil e Autenticação
Versão: 1.0.0
Responsável: Módulo de Identidade do Sistema QOTA

1. Visão Geral
Este módulo constitui o núcleo de segurança e identidade do sistema QOTA. É responsável por gerenciar o ciclo de vida completo do usuário, desde o cadastro inicial até o encerramento da conta, garantindo uma autenticação segura, persistência de sessão e conformidade com a LGPD através de um sistema de consentimento auditável e anonimização de dados.

1.1. Funcionalidades e Casos de Uso
Cadastro de Novos Usuários: Permite que um novo usuário crie uma conta fornecendo dados pessoais e consentindo com os termos de uso.

Autenticação de Usuários: Valida as credenciais (e-mail e senha) de um usuário para conceder acesso ao sistema.

Gerenciamento de Sessão: Mantém o usuário autenticado de forma segura, mesmo ao recarregar a página (F5), através de um fluxo de refresh token.

Gerenciamento de Perfil: Permite que o usuário visualize e atualize suas informações pessoais, como nome, telefone e foto de perfil.

Encerramento de Conta: Oferece ao usuário o direito de encerrar sua conta. O processo realiza um soft delete com anonimização para cumprir a LGPD sem comprometer a integridade do histórico do sistema.

2. Arquitetura e Fluxo de Dados
O fluxo de autenticação é baseado no padrão JWT com Access Token e Refresh Token, otimizado para segurança e experiência do usuário.

2.1. Fluxo de Autenticação Detalhado
Login Bem-Sucedido (POST /auth/login):

O backend valida as credenciais.

Gera um Access Token (curta duração, ~6h) e o envia no corpo da resposta.

Gera um Refresh Token (longa duração, ~7d) e o envia em um cookie httpOnly e secure.

O frontend recebe a resposta, armazena o Access Token na memória (estado do React) e o objeto do usuário no localStorage.

Requisição Autenticada (Ex: GET /user/:id):

O frontend, através do interceptor do Axios, anexa o Access Token da memória ao cabeçalho Authorization: Bearer <token>.

O backend, através do middleware protect, valida o token. Se válido, a requisição prossegue.

Sessão Expirada ou Refresh de Página (F5):

O Access Token em memória é perdido.

O AuthProvider no frontend, ao iniciar, detecta a ausência do token e dispara uma requisição para POST /auth/refresh.

Esta requisição não envia Authorization, mas o navegador anexa automaticamente o cookie httpOnly contendo o Refresh Token (graças à configuração withCredentials: true).

O backend valida o Refresh Token. Se for válido, ele gera um novo Access Token e retorna os dados completos do usuário.

O AuthProvider recebe a resposta, repopula o estado e a sessão do usuário é restaurada silenciosamente.

Encerramento de Conta (DELETE /user/:id):

O backend localiza o usuário.

Realiza a anonimização, alterando campos únicos (email, cpf) para valores ofuscados e únicos (ex: deleted_1634152800_email@exemplo.com).

Preenche o campo excludedAt com a data atual.

O registro é mantido para preservar a integridade do histórico (despesas, reservas), mas os dados pessoais são removidos.

3. Estrutura de Arquivos do Módulo
Abaixo está a lista completa de todos os arquivos que compõem este módulo.

3.1. Backend (/TCC-Back-main)
Caminho do Arquivo

Responsabilidade

src/controllers/Auth/login.Auth.controller.ts

Processa o login, valida credenciais e gera os tokens.

src/controllers/Auth/register.controller.ts

Gerencia o cadastro de novos usuários, verificando duplicidade em contas ativas.

src/controllers/Auth/refreshToken.Auth.controller.ts

Valida o refreshToken e emite um novo accessToken para restaurar a sessão.

src/controllers/Auth/logout.Auth.controller.ts

Invalida o refreshToken no banco de dados.

src/controllers/User/getById.User.controller.ts

Busca e retorna os dados de um usuário específico.

src/controllers/User/update.User.controller.ts

Atualiza as informações do perfil do usuário, incluindo o upload de fotos.

src/controllers/User/deleteById.User.controller.ts

Orquestra o processo de encerramento e anonimização da conta.

src/routes/auth.route.ts

Define as rotas públicas: /login, /register, /refresh, /logout.

src/routes/user.route.ts

Define as rotas protegidas para o CRUD de usuário: /:id, /upload/:id.

src/middleware/authMiddleware.ts

Contém o middleware protect que valida o accessToken em rotas protegidas.

src/config/corsOptions.ts

Configura a política de CORS, permitindo credentials para o fluxo de refreshToken.

prisma/schema.prisma

Define o modelo User e UserPhoto, incluindo os campos @unique e excludedAt.

3.2. Frontend (/TCC-Front_Web)
Caminho do Arquivo

Responsabilidade

src/context/AuthProvider.jsx

Componente Provedor que gerencia o estado global de autenticação (usuario, token).

src/context/AuthContext.jsx

Cria o contexto React para a autenticação.

src/hooks/useAuth.js

Hook customizado para facilitar o acesso ao AuthContext.

src/services/api.js

Instância centralizada do Axios com interceptors para anexar o accessToken e tratar erros 401/403.

src/components/ProtectedRoute.jsx

Componente de alta ordem que protege rotas, exibindo um loader enquanto a sessão é verificada.

src/components/auth/LoginForm.jsx

Componente de UI para o formulário de login.

src/components/ui/Input.jsx

Componente de UI genérico e reutilizável para campos de formulário.

src/pages/LoginPage.jsx

Página que renderiza o LoginForm.

src/pages/RegisterUser.jsx

Página para cadastro de novos usuários.

src/pages/EditProfile.jsx

Página para o usuário gerenciar seu perfil e encerrar a conta.

4. Documentação da API (Endpoints)
4.1. Autenticação (/api/v1/auth)
Verbo

Rota

Descrição

Autenticação

Corpo (Request)

Resposta (Sucesso)

POST

/register

Cadastra um novo usuário.

Nenhuma

{ email, password, nomeCompleto, cpf, ... }

201 Created - { success, message, data }

POST

/login

Autentica um usuário e retorna tokens e dados completos.

Nenhuma

{ email, password }

200 OK - { success, message, data: { accessToken, ...user } }

POST

/refresh

Gera um novo accessToken a partir do refreshToken (cookie).

Nenhuma (cookie)

Vazio

200 OK - { success, message, data: { accessToken, ...user } }

POST

/logout

Invalida o refreshToken no backend.

Nenhuma (cookie)

Vazio

200 OK - { success, message }

4.2. Usuário (/api/v1/user)
Verbo

Rota

Descrição

Autenticação

Corpo (Request)

Resposta (Sucesso)

GET

/:id

Busca os dados públicos de um usuário.

Obrigatória

Vazio

200 OK - { success, message, data: { ...user } }

PUT

/upload/:id

Atualiza os dados de um usuário (suporta upload de foto).

Obrigatória

multipart/form-data

200 OK - { success, message, data: { ...updatedUser } }

DELETE

/:id

Encerra e anonimiza a conta de um usuário.

Obrigatória

Vazio

200 OK - { success, message }