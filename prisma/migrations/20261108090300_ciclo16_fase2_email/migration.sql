-- CreateEnum
CREATE TYPE "CategoriaEmail" AS ENUM ('TRANSACIONAL', 'CICLO_DE_VIDA', 'MARKETING');

-- CreateEnum
CREATE TYPE "StatusEmail" AS ENUM ('ENFILEIRADO', 'ENVIADO', 'ENTREGUE', 'ABERTO', 'CLICADO', 'DEVOLVIDO', 'RECLAMACAO', 'FALHOU', 'SUPRIMIDO');

-- CreateEnum
CREATE TYPE "MotivoSupressao" AS ENUM ('DEVOLUCAO', 'RECLAMACAO', 'DESCADASTRO_TOTAL', 'MANUAL');

-- CreateTable
CREATE TABLE "emails_enviados" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "contaId" TEXT,
    "para" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "categoria" "CategoriaEmail" NOT NULL,
    "campanhaId" TEXT,
    "chaveIdempotencia" TEXT NOT NULL,
    "assunto" TEXT,
    "dados" JSONB,
    "provedorId" TEXT,
    "status" "StatusEmail" NOT NULL DEFAULT 'ENFILEIRADO',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),
    "abertoEm" TIMESTAMP(3),
    "clicadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_enviados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supressoes_email" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motivo" "MotivoSupressao" NOT NULL,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supressoes_email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emails_enviados_chaveIdempotencia_key" ON "emails_enviados"("chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "emails_enviados_provedorId_key" ON "emails_enviados"("provedorId");

-- CreateIndex
CREATE INDEX "emails_enviados_status_createdAt_idx" ON "emails_enviados"("status", "createdAt");

-- CreateIndex
CREATE INDEX "emails_enviados_userId_createdAt_idx" ON "emails_enviados"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "emails_enviados_contaId_createdAt_idx" ON "emails_enviados"("contaId", "createdAt");

-- CreateIndex
CREATE INDEX "emails_enviados_campanhaId_status_idx" ON "emails_enviados"("campanhaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supressoes_email_email_key" ON "supressoes_email"("email");
