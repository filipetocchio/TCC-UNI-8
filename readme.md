# Qota: Plataforma SaaS para Gestão de Bens Compartilhados

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## Sobre o Projeto

**Qota** é uma plataforma Micro-SaaS desenvolvida como um Trabalho de Conclusão de Curso em Engenharia de Software. O sistema aborda os desafios na gestão de bens em regime de multipropriedade, focando em resolver conflitos entre cotistas, otimizar o gerenciamento de despesas e aumentar a transparência no controle de inventário e contratos.

A plataforma substitui métodos manuais e descentralizados (como planilhas e grupos de mensagens) por uma solução digital integrada, intuitiva e segura, com foco inicial no setor imobiliário.

## Arquitetura

O sistema é construído sobre uma arquitetura de microsserviços para garantir escalabilidade, resiliência e separação de responsabilidades. A comunicação entre os serviços ocorre via requisições HTTP RESTful.

-   **Frontend (SPA):** Uma aplicação moderna em **React** responsável por toda a interface e experiência do usuário.
-   **Backend Principal (API RESTful):** Uma API robusta em **Node.js com Express e TypeScript**, responsável pela lógica de negócios, autenticação, gerenciamento de dados e comunicação com o banco de dados via **Prisma ORM**.
-   **Microsserviço de OCR (API RESTful):** Um serviço especializado em **Python com Flask**, dedicado ao processamento de documentos. Ele utiliza **Tesseract** e **OpenCV** para extrair texto de PDFs, validando comprovantes de endereço e extraindo dados de contas.

## Tecnologias Utilizadas

| Componente                | Tecnologias Principais                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| **Frontend** | React, Vite, Tailwind CSS, Axios, React Router                                           |
| **Backend (Principal)** | Node.js, Express, TypeScript, Prisma, Zod, JWT, Bcrypt                                   |
| **Microsserviço de OCR** | Python, Flask, Tesseract-OCR, OpenCV, PyMuPDF                                            |
| **Banco de Dados** | SQLite (Desenvolvimento), PostgreSQL (Preparado para Produção)                           |
| **DevOps & CI/CD** | Git, GitHub Actions                                                                      |

## Configuração do Ambiente de Desenvolvimento

Para executar o projeto completo localmente, você precisará de **3 terminais abertos simultaneamente**, um para cada serviço. Siga os passos na ordem correta.

###  Pré-requisitos Globais

Antes de começar, garanta que você tem os seguintes softwares instalados e configurados no seu sistema:

-   **[Git](https://git-scm.com/downloads)**: Para clonar o repositório.
-   **[Node.js](https://nodejs.org/en/)**: Versão `18.x` ou superior.
-   **[Python](https://www.python.org/downloads/)**: Versão `3.9` ou superior.
-   **[Tesseract-OCR](https://github.com/UB-Mannheim/tesseract/wiki)**: **Crucial.** Siga as instruções de instalação para o seu SO e **não se esqueça de adicionar o Tesseract ao PATH do sistema** durante a instalação.
-   **[Poppler](https://github.com/oschwartz10612/poppler-windows/releases)**: **Crucial.** Siga as instruções de instalação para o seu SO e **não se esqueça de adicionar o poppler ao PATH do sistema** durante a instalação.
---

### Instruções Passo a Passo

#### 1. Clone o Repositório

```bash
git clone [https://github.com/filipetocchio/TCC-UNI-8](https://github.com/filipetocchio/TCC-UNI-8)
cd TCC-UNI-8
```

#### 2. Configuração do Microsserviço de OCR (Python)

Este serviço precisa estar rodando para que a validação de documentos funcione.

```bash
# Navegue até a pasta do serviço
cd qota-ocr-service

# Crie e ative um ambiente virtual
python -m venv venv
# No Windows:
.\venv\Scripts\activate
# No Linux/macOS:
# source venv/bin/activate

# Crie o arquivo requirements.txt com o conteúdo abaixo
# (Flask, pytesseract, opencv-python-headless, Pillow, pdf2image, PyMuPDF, thefuzz, python-Levenshtein)
python -m pip install --upgrade pip
# Instale as dependências
pip install -r requirements.txt

# Inicie o servidor Python (deixe este terminal aberto)
python app.py
```

> **Nota:** O servidor do OCR irá rodar na porta `8000`.

#### 3. Configuração do Backend (Node.js)

Em um **novo terminal**, navegue até a pasta raiz do projeto novamente.

```bash
# Navegue até a pasta do backend
cd TCC-Back-main

# Instale as dependências
npm install

# Crie o arquivo .env na raiz de 'TCC-Back-main' e copie o conteúdo abaixo,
# ajustando as chaves secretas se desejar.
```

**Conteúdo para o arquivo `.env` do Backend:**

```env
# Porta do servidor backend
PORT=8001

# URL do frontend
ALLOWED_ORIGINS="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"

# Ambiente de execução
NODE_ENV="development"

# Segredos para tokens JWT (use valores seguros)
ACCESS_TOKEN_SECRET="chave_secreta_para_access_token_qota"
REFRESH_TOKEN_SECRET="chave_secreta_para_refresh_token_qota"

# URL do banco de dados (SQLite para dev)
DATABASE_URL="file:./prisma/dev.db"

# URL do microsserviço de OCR que acabamos de iniciar
OCR_SERVICE_URL="http://localhost:8000/processar-documento"
```

**Continue os comandos no terminal do backend:**

```bash
# Gere o cliente Prisma
npx prisma generate

# Execute as migrações para criar o banco de dados
npx prisma migrate dev

# Inicie o servidor de desenvolvimento (deixe este terminal aberto)
npm run dev
```

> **Nota:** O servidor do Backend irá rodar na porta `8001`.

#### 4. Configuração do Frontend (React)

Em um **terceiro terminal**, navegue até a pasta raiz do projeto mais uma vez.

```bash
# Navegue até a pasta do frontend
cd TCC-Front_Web

# Instale as dependências
npm install

# Crie o arquivo .env na raiz de 'TCC-Front_Web' e copie o conteúdo abaixo.
```

**Conteúdo para o arquivo `.env` do Frontend:**

```env
# Aponta para a URL da nossa API Node.js
VITE_API_URL="http://localhost:8001/api/v1"
```

**Continue os comandos no terminal do frontend:**

```bash
# Inicie a aplicação React (deixe este terminal aberto)
npm run dev
```

> **Nota:** A aplicação React estará acessível em `http://localhost:3000`.

### Resumo da Execução

Ao final, você terá 3 terminais abertos, cada um executando um serviço:
-   **Terminal 1 (OCR):** `python app.py`
-   **Terminal 2 (Backend):** `npm run dev`
-   **Terminal 3 (Frontend):** `npm run dev`

Abra seu navegador em `http://localhost:3000` para acessar o sistema Qota.