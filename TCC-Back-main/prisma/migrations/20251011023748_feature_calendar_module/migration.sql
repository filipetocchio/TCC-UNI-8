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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Propriedades" (
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
    "dataCadastro" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "excludedAt" DATETIME
);
INSERT INTO "new_Propriedades" ("createdAt", "dataCadastro", "enderecoBairro", "enderecoCep", "enderecoCidade", "enderecoComplemento", "enderecoLogradouro", "enderecoNumero", "enderecoPontoReferencia", "excludedAt", "id", "nomePropriedade", "tipo", "updatedAt", "valorEstimado") SELECT "createdAt", "dataCadastro", "enderecoBairro", "enderecoCep", "enderecoCidade", "enderecoComplemento", "enderecoLogradouro", "enderecoNumero", "enderecoPontoReferencia", "excludedAt", "id", "nomePropriedade", "tipo", "updatedAt", "valorEstimado" FROM "Propriedades";
DROP TABLE "Propriedades";
ALTER TABLE "new_Propriedades" RENAME TO "Propriedades";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
