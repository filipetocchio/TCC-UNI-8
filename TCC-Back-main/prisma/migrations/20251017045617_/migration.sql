-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "refreshToken" TEXT,
    "nomeCompleto" TEXT NOT NULL,
    "telefone" TEXT,
    "cpf" TEXT NOT NULL,
    "dataCadastro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataConsentimento" DATETIME,
    "versaoTermos" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Propriedades" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomePropriedade" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valorEstimado" REAL,
    "enderecoCep" TEXT,
    "enderecoCidade" TEXT,
    "enderecoBairro" TEXT,
    "enderecoLogradouro" TEXT,
    "enderecoNumero" TEXT,
    "enderecoComplemento" TEXT,
    "enderecoPontoReferencia" TEXT,
    "duracaoMinimaEstadia" INTEGER NOT NULL DEFAULT 1,
    "duracaoMaximaEstadia" INTEGER NOT NULL DEFAULT 7,
    "horarioCheckin" TEXT NOT NULL DEFAULT '15:00',
    "horarioCheckout" TEXT NOT NULL DEFAULT '11:00',
    "prazoCancelamentoReserva" INTEGER NOT NULL DEFAULT 14,
    "limiteFeriadosPorCotista" INTEGER,
    "limiteReservasAtivasPorCotista" INTEGER,
    "janelaAgendamentoDias" INTEGER NOT NULL DEFAULT 180,
    "totalFracoes" INTEGER NOT NULL DEFAULT 52,
    "diariasPorFracao" REAL NOT NULL DEFAULT 0.0,
    "dataCadastro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME
);

-- CreateTable
CREATE TABLE "UsuariosPropriedades" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idUsuario" INTEGER NOT NULL,
    "idPropriedade" INTEGER NOT NULL,
    "permissao" TEXT NOT NULL,
    "dataVinculo" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numeroDeFracoes" INTEGER NOT NULL DEFAULT 0,
    "saldoDiariasAtual" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME,
    CONSTRAINT "UsuariosPropriedades_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsuariosPropriedades_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "dataInicio" DATETIME NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "numeroHospedes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reserva_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reserva_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "dataVencimento" DATETIME NOT NULL,
    "categoria" TEXT NOT NULL,
    "observacao" TEXT,
    "urlComprovante" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "recorrenciaPaiId" INTEGER,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "frequencia" TEXT,
    "diaRecorrencia" INTEGER,
    "multaAtraso" REAL,
    "jurosAtraso" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Despesa_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Despesa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Despesa_recorrenciaPaiId_fkey" FOREIGN KEY ("recorrenciaPaiId") REFERENCES "Despesa" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "PagamentoCotista" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idDespesa" INTEGER NOT NULL,
    "idCotista" INTEGER NOT NULL,
    "valorDevido" REAL NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "dataPagamento" DATETIME,
    CONSTRAINT "PagamentoCotista_idDespesa_fkey" FOREIGN KEY ("idDespesa") REFERENCES "Despesa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PagamentoCotista_idCotista_fkey" FOREIGN KEY ("idCotista") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "estadoConservacao" TEXT NOT NULL DEFAULT 'BOM',
    "categoria" TEXT,
    "dataAquisicao" DATETIME,
    "descricao" TEXT,
    "valorEstimado" REAL,
    "codigoBarras" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME,
    CONSTRAINT "ItemInventario_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idReserva" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    CONSTRAINT "ChecklistInventario_idReserva_fkey" FOREIGN KEY ("idReserva") REFERENCES "Reserva" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistInventario_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemChecklist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idChecklist" INTEGER NOT NULL,
    "idItemInventario" INTEGER NOT NULL,
    "estadoConservacao" TEXT NOT NULL,
    "observacao" TEXT,
    "fotoUrl" TEXT,
    CONSTRAINT "ItemChecklist_idChecklist_fkey" FOREIGN KEY ("idChecklist") REFERENCES "ChecklistInventario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemChecklist_idItemInventario_fkey" FOREIGN KEY ("idItemInventario") REFERENCES "ItemInventario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FotoPropriedade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "documento" TEXT NOT NULL,
    "dataUpload" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME,
    CONSTRAINT "FotoPropriedade_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentoPropriedade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "dataUpload" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME,
    CONSTRAINT "DocumentoPropriedade_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FotoInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idItemInventario" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excludedAt" DATETIME,
    CONSTRAINT "FotoInventario_idItemInventario_fkey" FOREIGN KEY ("idItemInventario") REFERENCES "ItemInventario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "emailConvidado" TEXT NOT NULL,
    "idPropriedade" INTEGER NOT NULL,
    "idConvidadoPor" INTEGER NOT NULL,
    "permissao" TEXT NOT NULL,
    "usuarioJaExiste" BOOLEAN NOT NULL DEFAULT false,
    "dataExpiracao" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "aceitoEm" DATETIME,
    "numeroDeFracoes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Convite_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Convite_idConvidadoPor_fkey" FOREIGN KEY ("idConvidadoPor") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "idAutor" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notificacao_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notificacao_idAutor_fkey" FOREIGN KEY ("idAutor") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Penalidade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "dataFim" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Penalidade_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Penalidade_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataEspecial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataEspecial_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_NotificacoesLidas" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_NotificacoesLidas_A_fkey" FOREIGN KEY ("A") REFERENCES "Notificacao" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_NotificacoesLidas_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_refreshToken_key" ON "User"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosPropriedades_idUsuario_idPropriedade_key" ON "UsuariosPropriedades"("idUsuario", "idPropriedade");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoCotista_idDespesa_idCotista_key" ON "PagamentoCotista"("idDespesa", "idCotista");

-- CreateIndex
CREATE UNIQUE INDEX "ItemInventario_codigoBarras_key" ON "ItemInventario"("codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "UserPhoto_userId_key" ON "UserPhoto"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Convite_token_key" ON "Convite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "_NotificacoesLidas_AB_unique" ON "_NotificacoesLidas"("A", "B");

-- CreateIndex
CREATE INDEX "_NotificacoesLidas_B_index" ON "_NotificacoesLidas"("B");
