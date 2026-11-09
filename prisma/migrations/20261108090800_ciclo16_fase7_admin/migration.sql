-- CreateEnum
CREATE TYPE "TipoPagamentoPlataforma" AS ENUM ('ASSINATURA', 'CREDITO_IA');

-- CreateEnum
CREATE TYPE "StatusCampanha" AS ENUM ('RASCUNHO', 'AGENDADA', 'ENVIANDO', 'ENVIADA', 'CANCELADA');

-- AlterEnum
ALTER TYPE "RecursoIa" ADD VALUE 'MARKETING_ADMIN';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ultimoLoginEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "auditoria_admin" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "alvoId" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "motivo" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_plataforma" (
    "id" TEXT NOT NULL,
    "mpPaymentId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "tipo" "TipoPagamentoPlataforma" NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "metodo" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "referencia" TEXT,
    "compraId" TEXT,
    "emailPagador" TEXT,
    "bruto" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "preCabecalho" TEXT NOT NULL,
    "corpoMarkdown" TEXT NOT NULL,
    "rotuloBotao" TEXT,
    "urlBotao" TEXT,
    "segmento" JSONB NOT NULL,
    "categoria" "CategoriaEmail" NOT NULL DEFAULT 'MARKETING',
    "status" "StatusCampanha" NOT NULL DEFAULT 'RASCUNHO',
    "agendadaPara" TIMESTAMP(3),
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "publicoTotal" INTEGER NOT NULL DEFAULT 0,
    "enfileirados" INTEGER NOT NULL DEFAULT 0,
    "criadaPor" TEXT NOT NULL,
    "atualizadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_admin_createdAt_idx" ON "auditoria_admin"("createdAt");

-- CreateIndex
CREATE INDEX "auditoria_admin_alvoTipo_alvoId_idx" ON "auditoria_admin"("alvoTipo", "alvoId");

-- CreateIndex
CREATE INDEX "auditoria_admin_adminEmail_createdAt_idx" ON "auditoria_admin"("adminEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_plataforma_mpPaymentId_key" ON "pagamentos_plataforma"("mpPaymentId");

-- CreateIndex
CREATE INDEX "pagamentos_plataforma_contaId_createdAt_idx" ON "pagamentos_plataforma"("contaId", "createdAt");

-- CreateIndex
CREATE INDEX "pagamentos_plataforma_tipo_status_aprovadoEm_idx" ON "pagamentos_plataforma"("tipo", "status", "aprovadoEm");

-- CreateIndex
CREATE INDEX "campanhas_status_agendadaPara_idx" ON "campanhas"("status", "agendadaPara");
