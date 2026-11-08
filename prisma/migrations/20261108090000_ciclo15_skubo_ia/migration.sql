CREATE TYPE "StatusIaAssinatura" AS ENUM ('INATIVA', 'TESTE', 'ATIVA', 'PENDENTE', 'CANCELADA');

CREATE TYPE "TipoAnaliseIa" AS ENUM ('CONTROLE', 'SEMANAL');

CREATE TYPE "RecursoIa" AS ENUM ('CHAT', 'ANALISE_CONTROLE', 'EXPLICACAO', 'RESUMO_SEMANAL', 'TITULO');

CREATE TYPE "PapelMensagemIa" AS ENUM ('USUARIO', 'ASSISTENTE');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESUMO_IA';

ALTER TABLE "User" ADD COLUMN "receberResumoIa" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "analises_ia" ADD COLUMN "periodoFim" TIMESTAMP(3),
ADD COLUMN "periodoInicio" TIMESTAMP(3),
ADD COLUMN "tipo" "TipoAnaliseIa" NOT NULL DEFAULT 'CONTROLE';

ALTER TABLE "subscriptions" ADD COLUMN "iaLiberadaManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "iaOrcamentoCentavos" INTEGER,
ADD COLUMN "iaPeriodoFim" TIMESTAMP(3),
ADD COLUMN "iaStatus" "StatusIaAssinatura" NOT NULL DEFAULT 'INATIVA',
ADD COLUMN "iaTesteIniciadoEm" TIMESTAMP(3),
ADD COLUMN "mpPreapprovalIaId" TEXT;

UPDATE "subscriptions" SET "iaLiberadaManual" = true WHERE "iaAtiva" = true;

ALTER TABLE "subscriptions" DROP COLUMN "iaAtiva";

CREATE TABLE "conversas_ia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "arquivadaEm" TIMESTAMP(3),

    CONSTRAINT "conversas_ia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mensagens_ia" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "papel" "PapelMensagemIa" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ferramentas" JSONB,
    "util" BOOLEAN,
    "comentarioFeedback" TEXT,
    "modelo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_ia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "usos_ia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autorId" TEXT,
    "recurso" "RecursoIa" NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSaida" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheLeitura" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheEscrita" INTEGER NOT NULL DEFAULT 0,
    "custoCentavos" INTEGER,
    "duracaoMs" INTEGER NOT NULL,
    "sucesso" BOOLEAN NOT NULL,
    "codigoErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usos_ia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversas_ia_autorId_updatedAt_idx" ON "conversas_ia"("autorId", "updatedAt");

CREATE INDEX "conversas_ia_userId_idx" ON "conversas_ia"("userId");

CREATE INDEX "mensagens_ia_conversaId_createdAt_idx" ON "mensagens_ia"("conversaId", "createdAt");

CREATE INDEX "usos_ia_userId_createdAt_idx" ON "usos_ia"("userId", "createdAt");

CREATE INDEX "usos_ia_createdAt_idx" ON "usos_ia"("createdAt");

CREATE INDEX "analises_ia_userId_tipo_periodoInicio_idx" ON "analises_ia"("userId", "tipo", "periodoInicio");

CREATE UNIQUE INDEX "subscriptions_mpPreapprovalIaId_key" ON "subscriptions"("mpPreapprovalIaId");

ALTER TABLE "conversas_ia" ADD CONSTRAINT "conversas_ia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversas_ia" ADD CONSTRAINT "conversas_ia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mensagens_ia" ADD CONSTRAINT "mensagens_ia_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas_ia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usos_ia" ADD CONSTRAINT "usos_ia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
