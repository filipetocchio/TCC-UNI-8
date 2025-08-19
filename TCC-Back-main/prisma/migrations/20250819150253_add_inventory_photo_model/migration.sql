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
CREATE TABLE "FotoInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idItemInventario" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excludedAt" DATETIME,
    CONSTRAINT "FotoInventario_idItemInventario_fkey" FOREIGN KEY ("idItemInventario") REFERENCES "ItemInventario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemInventario_codigoBarras_key" ON "ItemInventario"("codigoBarras");
