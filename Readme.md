# Projeto QOTA - Plataforma de Gestão de Multipropriedade

## 📌 Visão Geral

Este repositório serve como o **hub central** do projeto QOTA, um Trabalho de Conclusão de Curso em Engenharia de Software.

Para uma melhor organização, profissionalismo e para seguir as práticas de arquitetura de microsserviços, o projeto foi dividido em três repositórios independentes. O código-fonte de cada aplicação reside em seu próprio repositório, com seu próprio histórico de commits e pipeline de CI/CD.

## 🚀 Repositórios do Projeto

Abaixo estão os links para os serviços que compõem a plataforma QOTA.

---

### 1. Back-end Principal (API)

[![Node.js](https://img.shields.io/badge/Node.js-18.x+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://github.com/filipetocchio/TCC-Back-main)

O `TCC-Back-main` é o núcleo do sistema. É um monólito modular construído em **Node.js, Express e TypeScript**, utilizando **Prisma** como ORM. Ele é responsável por toda a lógica de negócio, autenticação, gerenciamento de usuários, propriedades, finanças e o módulo de calendário.

**➡️ [Acessar o Repositório do Back-end](https://github.com/filipetocchio/TCC-Back-main)**

---

### 2. Front-end (Aplicação Web)

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://github.com/filipetocchio/TCC-Front_Web)

O `TCC-Front_Web` é a interface do usuário (UI) da plataforma. É uma **Single Page Application (SPA)** construída em **React (Vite)**, utilizando Tailwind CSS para estilização e `axios` para a comunicação segura com a API do back-end.

**➡️ [Acessar o Repositório do Front-end](https://github.com/filipetocchio/TCC-Front_Web)**

---

### 3. Microsserviço de OCR (IA)

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://github.com/filipetocchio/Qota-OCR-Service)

O `Qota-OCR-Service` é um microsserviço especializado, construído em **Python e Flask**. Sua única responsabilidade é processar documentos (PDFs), utilizando **Tesseract, OpenCV e PyMuPDF** para extrair dados (OCR) e **spaCy** para análise (NLP), validando comprovantes de endereço e faturas financeiras.

**➡️ [Acessar o Repositório do Serviço de OCR](https://github.com/filipetocchio/Qota-OCR-Service)**

---

### 📋 Instruções para Execução

**Cada um dos três repositórios acima é 100% independente e contém seu próprio arquivo `Instruções_para_rodar.md`** com um guia passo a passo detalhado para a configuração do ambiente, instalação de dependências e execução de cada serviço.



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

O sistema é construído sobre uma arquitetura Cliente-Servidor, onde o Servidor foi implementado seguindo um padrão Monolítico Modular com um Microserviço de Apoio para tarefas especializadas. A comunicação ocorre via requisições HTTP RESTful.

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

### ⚙️ Instalação das Dependências do OCR (Obrigatório)

O microsserviço de OCR depende de duas ferramentas externas. A instalação correta delas é **crucial** para o funcionamento do sistema.

---
#### **Instrução para Windows**

1.  **Instalar Tesseract-OCR:**
    * Baixe o instalador `tesseract-ocr-w64-setup-*.exe` a partir de [**Tesseract at UB Mannheim**](https://github.com/UB-Mannheim/tesseract/wiki).
    * Execute o instalador. Durante a instalação, na tela "Additional language data", marque a opção **"Portuguese"** para adicionar o suporte ao idioma português.
    * **IMPORTANTE:** Na tela de instalação, certifique-se de marcar a opção **"Add Tesseract to the system PATH"**. Isso configura a variável de ambiente automaticamente.

2.  **Instalar Poppler:**
    * Baixe a versão mais recente do [**Poppler for Windows**](https://github.com/oschwartz10612/poppler-windows/releases/). Procure pelo arquivo `Release-*.zip`.
    * Extraia o conteúdo do arquivo `.zip` para uma pasta permanente no seu computador (ex: `C:\Program Files\poppler`).
    * Copie o caminho da pasta `bin` que está dentro do diretório que você extraiu (ex: `C:\Program Files\poppler\bin`).
    * Adicione este caminho ao **PATH do sistema**:
        * Pesquise por "Editar as variáveis de ambiente do sistema" no menu Iniciar.
        * Clique em "Variáveis de Ambiente...".
        * Na seção "Variáveis do sistema", encontre e selecione a variável `Path` e clique em "Editar".
        * Clique em "Novo", cole o caminho da pasta `bin` do Poppler e clique em "OK" em todas as janelas.

3.  **Verificação:**
    * Abra um **novo** terminal (importante para carregar o novo PATH) e execute os comandos `tesseract --version` e `pdftoppm -v`. Se ambos os comandos exibirem as versões das ferramentas, a instalação foi bem-sucedida.

---
#### **Instrução para Linux (Debian/Ubuntu)**

1.  **Instalar Tesseract-OCR e Poppler:**
    * Abra o terminal e execute os comandos abaixo para instalar as ferramentas e o pacote de idioma português:
    ```bash
    sudo apt update
    sudo apt install -y tesseract-ocr tesseract-ocr-por poppler-utils
    ```
2.  **Verificação:**
    * Execute os comandos `tesseract --version` e `pdftoppm -v`. Se ambos exibirem as versões, a instalação está correta.

---
#### **Instrução para macOS (usando Homebrew)**

1.  **Instalar Tesseract-OCR e Poppler:**
    * Se você não tiver o [Homebrew](https://brew.sh/index_pt-br) instalado, instale-o primeiro.
    * Abra o terminal e execute os comandos para instalar as ferramentas e o pacote de idioma português:
    ```bash
    brew install tesseract tesseract-lang poppler
    ```
2.  **Verificação:**
    * Execute os comandos `tesseract --version` e `pdftoppm -v`. Se ambos exibirem as versões, a instalação está correta.

---


### Instruções Passo a Passo

#### 1. Clone o Repositório

```bash
git clone https://github.com/filipetocchio/TCC-UNI-8
cd TCC-UNI-8
```

#### 2. Configuração do Microsserviço de OCR (Python)

Este serviço precisa estar rodando para que a validação de documentos funcione.

```bash
# Navegue até a pasta do serviço
cd TCC-UNI-8

cd qota-ocr-service

# Crie e ative um ambiente virtual
python -m venv venv
# No Windows:
.\venv\Scripts\activate

# No Linux/macOS:
source venv/bin/activate

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

cd TCC-UNI-8

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

cd TCC-UNI-8

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