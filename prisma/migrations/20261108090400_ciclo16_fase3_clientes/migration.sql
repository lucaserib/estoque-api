-- CreateEnum
CREATE TYPE "TipoConsentimento" AS ENUM ('TERMOS', 'PRIVACIDADE', 'MARKETING_EMAIL', 'MARKETING_WHATSAPP', 'CICLO_DE_VIDA');

-- CreateEnum
CREATE TYPE "StatusSolicitacaoExclusao" AS ENUM ('PENDENTE', 'EXECUTADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferencias" JSONB;

-- CreateTable
CREATE TABLE "perfis_cliente" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nomeLoja" TEXT,
    "whatsapp" TEXT,
    "faixaPedidosMes" TEXT,
    "canais" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "comoConheceu" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "paginaEntrada" TEXT,
    "referrer" TEXT,
    "primeiroToqueEm" TIMESTAMP(3),
    "codigoIndicacao" TEXT NOT NULL,
    "testeInterno" BOOLEAN NOT NULL DEFAULT false,
    "perfilCompletoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfis_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimentos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoConsentimento" NOT NULL,
    "concedido" BOOLEAN NOT NULL,
    "versaoTexto" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_produto" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "userId" TEXT,
    "nome" TEXT NOT NULL,
    "propriedades" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes_exclusao" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motivo" TEXT,
    "status" "StatusSolicitacaoExclusao" NOT NULL DEFAULT 'PENDENTE',
    "executadaEm" TIMESTAMP(3),
    "executadaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_exclusao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfis_cliente_contaId_key" ON "perfis_cliente"("contaId");

-- CreateIndex
CREATE UNIQUE INDEX "perfis_cliente_codigoIndicacao_key" ON "perfis_cliente"("codigoIndicacao");

-- CreateIndex
CREATE INDEX "perfis_cliente_utmSource_idx" ON "perfis_cliente"("utmSource");

-- CreateIndex
CREATE INDEX "perfis_cliente_comoConheceu_idx" ON "perfis_cliente"("comoConheceu");

-- CreateIndex
CREATE INDEX "consentimentos_userId_tipo_createdAt_idx" ON "consentimentos"("userId", "tipo", "createdAt");

-- CreateIndex
CREATE INDEX "consentimentos_tipo_concedido_idx" ON "consentimentos"("tipo", "concedido");

-- CreateIndex
CREATE INDEX "eventos_produto_contaId_nome_idx" ON "eventos_produto"("contaId", "nome");

-- CreateIndex
CREATE INDEX "eventos_produto_nome_createdAt_idx" ON "eventos_produto"("nome", "createdAt");

-- CreateIndex
CREATE INDEX "solicitacoes_exclusao_status_createdAt_idx" ON "solicitacoes_exclusao"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "perfis_cliente" ADD CONSTRAINT "perfis_cliente_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimentos" ADD CONSTRAINT "consentimentos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_produto" ADD CONSTRAINT "eventos_produto_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "perfis_cliente" ("id", "contaId", "nomeLoja", "codigoIndicacao", "canais", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", c."nomeLoja", 'SKU-' || UPPER(SUBSTRING(MD5(u."id") FROM 1 FOR 6)), ARRAY[]::TEXT[], NOW(), NOW()
FROM "User" u
LEFT JOIN "configuracoes_gerais" c ON c."userId" = u."id"
WHERE u."contaId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "perfis_cliente" p WHERE p."contaId" = u."id");
