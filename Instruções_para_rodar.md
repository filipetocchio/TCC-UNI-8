
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