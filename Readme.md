# Projeto QOTA - Plataforma de Gestão de Multipropriedade

## 📌 Visão Geral

Este repositório serve como o **hub central** do projeto QOTA, um Trabalho de Conclusão de Curso em Engenharia de Software.

Para uma melhor organização, profissionalismo e para seguir as práticas de arquitetura, o projeto foi dividido em três repositórios independentes. O código-fonte de cada aplicação reside em seu próprio repositório, com seu próprio histórico de commits e pipeline de CI/CD.

## 🚀 Repositórios do Projeto

Abaixo estão os links para os serviços que compõem a plataforma QOTA.

---

### 1. Back-end Principal (API)

[![Node.js](https://img.shields.io/badge/Node.js-18.x+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://github.com/filipetocchio/TCC-Back-main)

O `TCC-Back-main` é o núcleo do sistema. É um monólito modular construído em **Node.js, Express e TypeScript**, utilizando **Prisma** como ORM. Ele é responsável por toda a lógica de negócio, autenticação, gerenciamento de usuários, propriedades, finanças e o módulo de calendário.

**➡️ [Acessar o Repositório do Back-end](https://github.com/filipetocchio/TCC-Back-main)**

```bash
git clone https://github.com/filipetocchio/TCC-Back-main
```

---
---

### 2. Front-end (Aplicação Web)

[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://github.com/filipetocchio/TCC-Front_Web)

O `TCC-Front_Web` é a interface do usuário (UI) da plataforma. É uma **Single Page Application (SPA)** construída em **React (Vite)**, utilizando Tailwind CSS para estilização e `axios` para a comunicação segura com a API do back-end.

**➡️ [Acessar o Repositório do Front-end](https://github.com/filipetocchio/TCC-Front_Web)**

```bash
git clone https://github.com/filipetocchio/TCC-Front_Web
```
---

### 3. Microsserviço de OCR (IA)

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://github.com/filipetocchio/Qota-OCR-Service)

O `Qota-OCR-Service` é um microsserviço especializado, construído em **Python e Flask**. Sua única responsabilidade é processar documentos (PDFs), utilizando **Tesseract, OpenCV e PyMuPDF** para extrair dados (OCR) e **spaCy** para análise (NLP), validando comprovantes de endereço e faturas financeiras.

**➡️ [Acessar o Repositório do Serviço de OCR](https://github.com/filipetocchio/Qota-OCR-Service)**

```bash
git clone https://github.com/filipetocchio/Qota-OCR-Service
```

---

### 📋 Instruções para Execução

**Cada um dos três repositórios acima é 100% independente e contém seu próprio arquivo `Instruções_para_rodar.md`** com um guia passo a passo detalhado para a configuração do ambiente, instalação de dependências e execução de cada serviço.

