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
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Propriedades" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomePropriedade" TEXT NOT NULL,
    "enderecoCep" TEXT,
    "enderecoCidade" TEXT,
    "enderecoBairro" TEXT,
    "enderecoLogradouro" TEXT,
    "enderecoNumero" TEXT,
    "enderecoComplemento" TEXT,
    "enderecoPontoReferencia" TEXT,
    "tipo" TEXT NOT NULL,
    "valorEstimado" REAL,
    "documento" TEXT,
    "dataCadastro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
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
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME,
    CONSTRAINT "UsuariosPropriedades_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UsuariosPropriedades_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FotosPropriedade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "documento" TEXT NOT NULL,
    "dataUpload" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME,
    CONSTRAINT "FotosPropriedade_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentosPropriedade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idPropriedade" INTEGER NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "dataUpload" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME,
    CONSTRAINT "DocumentosPropriedade_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_refreshToken_key" ON "User"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "UsuariosPropriedades_idUsuario_idPropriedade_key" ON "UsuariosPropriedades"("idUsuario", "idPropriedade");
