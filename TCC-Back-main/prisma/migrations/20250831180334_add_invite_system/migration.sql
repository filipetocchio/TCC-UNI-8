-- CreateTable
CREATE TABLE "Convite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "emailConvidado" TEXT NOT NULL,
    "idPropriedade" INTEGER NOT NULL,
    "idConvidadoPor" INTEGER NOT NULL,
    "permissao" TEXT NOT NULL,
    "dataExpiracao" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "aceitoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Convite_idPropriedade_fkey" FOREIGN KEY ("idPropriedade") REFERENCES "Propriedades" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Convite_idConvidadoPor_fkey" FOREIGN KEY ("idConvidadoPor") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Convite_token_key" ON "Convite"("token");
