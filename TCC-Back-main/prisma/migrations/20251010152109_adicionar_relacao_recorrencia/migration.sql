-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Despesa" (
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
    CONSTRAINT "Despesa_recorrenciaPaiId_fkey" FOREIGN KEY ("recorrenciaPaiId") REFERENCES "Despesa" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "Despesa_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Despesa" ("categoria", "createdAt", "criadoPorId", "dataVencimento", "descricao", "diaRecorrencia", "frequencia", "id", "idPropriedade", "jurosAtraso", "multaAtraso", "observacao", "recorrente", "status", "updatedAt", "urlComprovante", "valor") SELECT "categoria", "createdAt", "criadoPorId", "dataVencimento", "descricao", "diaRecorrencia", "frequencia", "id", "idPropriedade", "jurosAtraso", "multaAtraso", "observacao", "recorrente", "status", "updatedAt", "urlComprovante", "valor" FROM "Despesa";
DROP TABLE "Despesa";
ALTER TABLE "new_Despesa" RENAME TO "Despesa";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
