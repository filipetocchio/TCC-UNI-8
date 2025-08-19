# TCC-UNI

# Sobre

Nosso projeto é voltado para as pessoas que possuem algum bem compartilhado dentro do sistema de cotas, (um grupo de pessoas ou uma sociedade ou sócios de algum bem que possuem alguma porcentagem), e que possuem dificuldades para gerenciar seu bem, principalmente na parte financeira e na parte de agendamento para o uso do bem.

Os diferentes módulos permitem que o sistema seja usado de forma dinâmica, sendo assim atendendo a necessidade das pessoas que possuírem algum “**imóveis**”, “**terrenos**”, “**veículos**”, “**embarcações**” e “**aeronaves**”, que são os principais modelos de sistemas que queremos fazer.


## 🚀 Primeiros Passos (Back)

Para começar a usar a API localmente, siga este guia:

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/filipetocchio/TCC-UNI-8
   cd TCC-Back-main
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure o arquivo `.env`** (veja detalhes na seção [Configuração do Ambiente](#configuração-do-ambiente)).

4. **Execute as migrações do banco**:
   ```bash
   npm run migrate
   ```

5. **Inicie o servidor**:
   ```bash
   npm run dev
   ```

6. **Teste a API**:
   - Use o Postman para enviar uma requisição `POST` para `http://localhost:8001/api/v1/auth/register`.
   - Exemplo:
     ```bash
     curl -X POST http://localhost:8001/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"joao.silva@example.com","password":"senha123","nomeCompleto":"João da Silva","cpf":"12345678901","telefone":"11987654321"}'
     ```

---

## 🛠️ Pré-requisitos

- **Node.js**: v18.x ou superior
- **npm**: v8.x ou superior
- **SQLite**: Para desenvolvimento local
- **Postman**: Ou outra ferramenta para testar endpoints
- **Git**: Para clonar o repositório

---


## 🚀 Primeiros Passos (Front)

## 🚀 Como Rodar o Projeto 

### 1. Clone o repositório


git clone https://github.com/filipetocchio/TCC-UNI-8
cd TCC-Front_Web

### 2. Instale as dependências

npm install

### 3. Execute o projeto

npm run dev    
