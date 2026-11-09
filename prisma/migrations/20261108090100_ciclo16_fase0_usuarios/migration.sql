-- CreateEnum
CREATE TYPE "FinalidadeToken" AS ENUM ('REDEFINIR_SENHA', 'CONFIRMAR_EMAIL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ASSINATURA';
ALTER TYPE "NotificationType" ADD VALUE 'EQUIPE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bloqueadoEm" TIMESTAMP(3),
ADD COLUMN     "emailVerificadoEm" TIMESTAMP(3),
ADD COLUMN     "motivoBloqueio" TEXT,
ADD COLUMN     "sessaoValidaDesde" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tokens_senha" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "finalidade" "FinalidadeToken" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contadores_limite" (
    "chave" TEXT NOT NULL,
    "contagem" INTEGER NOT NULL DEFAULT 0,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contadores_limite_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "auditoria_conta" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "autorId" TEXT,
    "acao" TEXT NOT NULL,
    "alvoTipo" TEXT,
    "alvoId" TEXT,
    "detalhe" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_conta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_senha_tokenHash_key" ON "tokens_senha"("tokenHash");

-- CreateIndex
CREATE INDEX "tokens_senha_userId_finalidade_idx" ON "tokens_senha"("userId", "finalidade");

-- CreateIndex
CREATE INDEX "contadores_limite_expiraEm_idx" ON "contadores_limite"("expiraEm");

-- CreateIndex
CREATE INDEX "auditoria_conta_contaId_createdAt_idx" ON "auditoria_conta"("contaId", "createdAt");

-- AddForeignKey
ALTER TABLE "tokens_senha" ADD CONSTRAINT "tokens_senha_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


DELETE FROM "subscriptions" s
USING "User" u
WHERE s."userId" = u."id"
  AND u."contaId" IS NOT NULL
  AND s."mpPreapprovalId" IS NULL
  AND s."mpPreapprovalIaId" IS NULL;

INSERT INTO "subscriptions" ("id", "userId", "status", "trialEndsAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'TRIALING', NOW() + INTERVAL '7 days', NOW(), NOW()
FROM "User" u
WHERE u."contaId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."userId" = u."id");

UPDATE "User" SET "emailVerificadoEm" = "createdAt" WHERE "password" IS NULL AND "emailVerificadoEm" IS NULL;
