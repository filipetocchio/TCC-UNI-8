# Documentação da API - Qota

![Node.js](https://img.shields.io/badge/Node.js-v20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=for-the-badge&logo=prisma&logoColor=white)

## 📖 Introdução

[cite_start]O **Qota** é uma plataforma Micro-SaaS para a gestão de bens em regime de multipropriedade imobiliária. [cite: 12] [cite_start]Desenvolvido como um Trabalho de Conclusão de Curso em Engenharia de Software, o projeto visa resolver desafios comuns como conflitos entre cotistas, gestão ineficiente de despesas e falta de transparência no controle de inventário e contratos. [cite: 12, 13]

Esta documentação detalha a API do backend principal, construída em Node.js, que serve como o núcleo para a lógica de negócios, gerenciamento de dados e autenticação de usuários da plataforma Qota.

### Funcionalidades Implementadas

-   [cite_start]🔒 **Autenticação Segura**: Fluxo completo de registro, login, logout e renovação de tokens (Access e Refresh Tokens) via JWT, com conformidade LGPD no registro. [cite: 108, 116]
-   [cite_start]👥 **Gestão de Usuários e Cotistas**: CRUD de usuários e um sistema de convites baseado em tokens para adicionar cotistas a uma propriedade, com controle de permissões (RBAC). [cite: 110, 111]
-   [cite_start]🏡 **Gestão de Propriedades**: CRUD completo para ativos imobiliários, com upload de fotos e documentos associados. [cite: 105]
-   [cite_start]📦 **Controle de Inventário**: Módulo detalhado para registrar e gerenciar todos os itens físicos contidos em um imóvel, com suporte a múltiplas fotos por item. [cite: 112]
-   [cite_start]🤖 **Validação com IA (OCR)**: Integração com um microsserviço Python para validar comprovantes de endereço em PDF no momento do cadastro da propriedade. [cite: 106]
-   [cite_start]💸 **Módulo Financeiro (Inicial)**: Endpoint para upload de contas (PDF), que utiliza o microsserviço de OCR para extrair dados (valor, vencimento) e registrar a despesa no sistema. [cite: 115]

---

## 🏗️ Arquitetura

O sistema adota uma arquitetura de microsserviços para garantir escalabilidade e separação de responsabilidades.

-   **Backend Principal (Esta API):** Construído em **Node.js com Express e TypeScript**, é o cérebro da aplicação, gerenciando usuários, propriedades, permissões e orquestrando chamadas para outros serviços.
-   **Microsserviço de OCR:** Um serviço especializado em **Python com Flask**, responsável por todo o processamento de documentos (PDFs), utilizando **PyMuPDF** para extração direta e **Tesseract-OCR** como fallback para PDFs escaneados.

---

## 🛠️ Tecnologias Utilizadas

-   **Backend**: Node.js, Express, TypeScript
-   **Banco de Dados**: SQLite (Desenvolvimento), com suporte para PostgreSQL (Produção)
-   **ORM**: Prisma
-   **Autenticação**: JSON Web Token (JWT), `bcrypt`
-   **Validação de Schemas**: Zod
-   **Upload de Arquivos**: Multer
-   **CI/CD**: GitHub Actions

---

## 🚀 Configuração do Ambiente

Para executar a API localmente, é necessário rodar o **Backend Principal** e o **Microsserviço de OCR** simultaneamente.

### Pré-requisitos

-   **Node.js**: `v20.x` ou superior
-   **Python**: `v3.9` ou superior
-   **Git**
-   **Tesseract-OCR**: Essencial para o microsserviço. Deve ser instalado no sistema operacional e adicionado ao `PATH`.

### Instruções de Instalação

1.  **Clone o repositório** e entre na pasta principal.

2.  **Configure o Microsserviço de OCR (Python)**
    -   Em um terminal, navegue até a pasta `qota-ocr-service`.
    -   Crie e ative um ambiente virtual.
    -   Instale as dependências: `pip install -r requirements.txt`
    -   **Importante:** Abra o arquivo `app.py` e ajuste o caminho para o executável do Tesseract na linha `pytesseract.pytesseract.tesseract_cmd`.
    -   Inicie o serviço: `python app.py`. Ele rodará na porta `8000`.

3.  **Configure o Backend Principal (Node.js)**
    -   Em um **novo terminal**, navegue até a pasta `TCC-Back-main`.
    -   Instale as dependências: `npm install`.
    -   Crie um arquivo `.env` na raiz de `TCC-Back-main` e configure as variáveis:

    ```env
    # Porta do servidor backend
    PORT=8001

    # URL do frontend para CORS
    ALLOWED_ORIGINS="http://localhost:3000"
    FRONTEND_URL="http://localhost:3000"

    # Ambiente
    NODE_ENV="development"

    # Segredos JWT (gere chaves seguras para produção)
    ACCESS_TOKEN_SECRET="sua_chave_secreta_aqui_1234567890"
    REFRESH_TOKEN_SECRET="outra_chave_secreta_aqui_0987654321"

    # Banco de dados
    DATABASE_URL="file:./prisma/dev.db"

    # URL do microsserviço de OCR
    OCR_SERVICE_URL="http://localhost:8000/processar-documento"
    ```
    -   Execute as migrações do Prisma: `npx prisma migrate dev`.
    -   Inicie o servidor: `npm run dev`. Ele rodará na porta `8001`.

---

## 🗄️ Estrutura do Banco de Dados

O `schema.prisma` define os seguintes modelos principais, refletindo a estrutura de dados atual da aplicação:

```prisma
// Modelo de Usuários
model User {
  id              Int      @id @default(autoincrement())
  email           String   @unique
  password        String
  nomeCompleto    String
  cpf             String   @unique
  // ... campos de consentimento e relacionamentos
  propriedades    UsuariosPropriedades[]
  convitesEnviados Convite[]
}

// Modelo de Propriedades
model Propriedades {
  id              Int      @id @default(autoincrement())
  nomePropriedade String
  tipo            String
  // ... campos de endereço
  usuarios        UsuariosPropriedades[]
  inventario      ItemInventario[]
  convites        Convite[]
  despesas        Despesa[]
}

// Tabela de Vínculo (N-para-N) entre Usuários e Propriedades
model UsuariosPropriedades {
  id            Int      @id @default(autoincrement())
  idUsuario     Int
  idPropriedade Int
  permissao     String // "proprietario_master" ou "proprietario_comum"
  // ... relacionamentos
}

// Modelo de Itens de Inventário
model ItemInventario {
  id              Int      @id @default(autoincrement())
  idPropriedade   Int
  nome            String
  quantidade      Int
  // ... outros campos e relacionamento com fotos
}

// Modelo de Convites
model Convite {
  id              Int      @id @default(autoincrement())
  token           String   @unique
  emailConvidado  String
  idPropriedade   Int
  permissao       String
  status          StatusConvite @default(PENDENTE)
  // ...
}

// Modelo de Despesas
model Despesa {
  id              Int      @id @default(autoincrement())
  idPropriedade   Int
  descricao       String
  valor           Float
  dataVencimento  DateTime
  status          StatusPagamento @default(PENDENTE)
  // ...
}
```

---

## 📜 Lista de Endpoints

A base para todas as rotas é `/api/v1`. Todas as rotas (exceto registro, login e verificação de convite) são protegidas e requerem um `Bearer Token` de autenticação.

<details>
<summary><strong>Auth (/auth)</strong></summary>

-   `POST /register`: Registra um novo usuário.
-   `POST /login`: Realiza o login.
-   `POST /logout`: Realiza o logout (requer cookie).
-   `POST /refresh`: Renova o access token (requer cookie).

</details>

<details>
<summary><strong>Users (/user)</strong></summary>

-   `GET /`: Lista todos os usuários com paginação e busca.
-   `GET /:id`: Busca um usuário por ID.
-   `PUT /:id`: Atualiza dados de um usuário (sem foto).
-   `PUT /upload/:id`: Atualiza dados de um usuário, incluindo foto de perfil.
-   `DELETE /:id`: Realiza o soft-delete de um usuário.

</details>

<details>
<summary><strong>Properties (/property)</strong></summary>

-   `POST /create`: Cria uma nova propriedade.
-   `GET /`: Lista todas as propriedades com paginação e filtros.
-   `GET /:id`: Busca uma propriedade por ID com todos os detalhes.
-   `PUT /:id`: Atualiza uma propriedade.
-   `DELETE /:id`: Realiza o soft-delete de uma propriedade.

</details>

<details>
<summary><strong>Inventory (/inventory)</strong></summary>

-   `POST /create`: Adiciona um novo item ao inventário de uma propriedade.
-   `GET /property/:propertyId`: Lista todos os itens de inventário de uma propriedade.
-   `PUT /:id`: Atualiza um item de inventário.
-   `DELETE /:id`: Realiza o soft-delete de um item de inventário.

</details>

<details>
<summary><strong>Inventory Photos (/inventoryPhoto)</strong></summary>

-   `POST /upload`: Faz upload de uma foto para um item de inventário.
-   `DELETE /:id`: Realiza o soft-delete de uma foto de inventário.

</details>

<details>
<summary><strong>Invites (/invite)</strong></summary>

-   `POST /`: Cria e envia um convite para um novo membro.
-   `GET /verify/:token`: Verifica a validade de um token de convite (público).
-   `POST /accept/:token`: Aceita um convite, vinculando o usuário logado à propriedade.
-   `GET /property/:propertyId/pending`: Lista convites pendentes de uma propriedade.

</details>

<details>
<summary><strong>Permissions (/permission)</strong></summary>

-   `GET /:id`: Lista os membros (cotistas) de uma propriedade específica.
-   `PUT /:id`: Atualiza a permissão de um membro (vínculo `UsuariosPropriedades`).

</details>

<details>
<summary><strong>Validation (/validation)</strong></summary>

-   `POST /address`: Valida um comprovante de endereço em PDF via serviço de OCR.

</details>

<details>
<summary><strong>Financial (/financial)</strong></summary>

-   `POST /upload-invoice`: Faz upload de uma conta em PDF, extrai os dados via OCR e registra como uma despesa.

</details>

---

## 📚 Endpoints Detalhados (Exemplos Chave)

#### POST `/validation/address`

Valida se o endereço fornecido em um formulário corresponde ao endereço contido em um comprovante em PDF.

-   **Método**: `POST`
-   **Tipo de Conteúdo**: `multipart/form-data`
-   **Body**:
    -   `documento` (file): O arquivo PDF a ser validado.
    -   `address` (string): O endereço do formulário (ex: "Rua Exemplo, 123").
    -   `cep` (string): O CEP do formulário (ex: "12345-678").
-   **Resposta de Sucesso (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Endereço validado com sucesso via CEP."
    }
    ```
-   **Resposta de Falha (400 Bad Request)**:
    ```json
    {
      "success": false,
      "message": "Não foi possível validar o endereço no documento fornecido."
    }
    ```

#### POST `/invite`

Cria um convite para um novo usuário se juntar a uma propriedade. Apenas `proprietario_master` pode realizar esta ação.

-   **Método**: `POST`
-   **Body (JSON)**:
    ```json
    {
      "emailConvidado": "novo.membro@example.com",
      "idPropriedade": 1,
      "permissao": "proprietario_comum"
    }
    ```
-   **Resposta de Sucesso (201 Created)**:
    ```json
    {
      "success": true,
      "message": "Convite criado com sucesso para novo.membro@example.com.",
      "data": {
        "linkConvite": "http://localhost:3000/convite/a1b2c3d4e5f6..."
      }
    }
    ```

---

## 🔮 Próximos Passos e Visão Futura

Com base no escopo do projeto, os próximos passos planejados incluem:

-   [cite_start]**Integração com Blockchain**: Para criar um "cartório digital" descentralizado, permitindo o registro imutável de propriedades e a tokenização de frações, aumentando a segurança e transparência. [cite: 38]
-   [cite_start]**Expansão para Pool Hoteleiro**: Integração com plataformas como Booking.com para gerenciar propriedades no modelo de pool. [cite: 27]
-   [cite_start]**Inteligência Artificial Preditiva**: Implementação de IA para analisar padrões de uso e otimizar agendamentos ou prever despesas de manutenção. [cite: 292]