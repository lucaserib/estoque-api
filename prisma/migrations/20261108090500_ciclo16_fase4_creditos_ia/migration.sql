-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CREDITOS_IA';

-- CreateEnum
CREATE TYPE "OrigemLoteCreditoIa" AS ENUM ('TESTE', 'COMPRA', 'INDICACAO', 'BONUS_ADMIN', 'MIGRACAO');

-- CreateEnum
CREATE TYPE "TipoMovimentoCreditoIa" AS ENUM ('ENTRADA', 'CONSUMO', 'ESTORNO', 'EXPIRACAO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "StatusCompraCreditoIa" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA', 'ESTORNADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "lotes_credito_ia" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "origem" "OrigemLoteCreditoIa" NOT NULL,
    "quantidadeInicial" INTEGER NOT NULL,
    "quantidadeRestante" INTEGER NOT NULL,
    "validoAte" TIMESTAMP(3) NOT NULL,
    "compraId" TEXT,
    "indicacaoId" TEXT,
    "descricao" TEXT,
    "chaveIdempotencia" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_credito_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_credito_ia" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "autorId" TEXT,
    "loteId" TEXT,
    "tipo" "TipoMovimentoCreditoIa" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "saldoApos" INTEGER NOT NULL,
    "recurso" "RecursoIa",
    "usoIaId" TEXT,
    "descricao" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_credito_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_credito_ia" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "pacoteId" TEXT NOT NULL,
    "pacoteNome" TEXT NOT NULL,
    "perguntas" INTEGER NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "descontoCentavos" INTEGER NOT NULL DEFAULT 0,
    "cupomId" TEXT,
    "status" "StatusCompraCreditoIa" NOT NULL DEFAULT 'PENDENTE',
    "mpPreferenceId" TEXT,
    "mpPaymentId" TEXT,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprovadaEm" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_credito_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lotes_credito_ia_compraId_key" ON "lotes_credito_ia"("compraId");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_credito_ia_chaveIdempotencia_key" ON "lotes_credito_ia"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "lotes_credito_ia_contaId_validoAte_idx" ON "lotes_credito_ia"("contaId", "validoAte");

-- CreateIndex
CREATE INDEX "lotes_credito_ia_validoAte_quantidadeRestante_idx" ON "lotes_credito_ia"("validoAte", "quantidadeRestante");

-- CreateIndex
CREATE UNIQUE INDEX "movimentos_credito_ia_chaveIdempotencia_key" ON "movimentos_credito_ia"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "movimentos_credito_ia_contaId_createdAt_idx" ON "movimentos_credito_ia"("contaId", "createdAt");

-- CreateIndex
CREATE INDEX "movimentos_credito_ia_tipo_createdAt_idx" ON "movimentos_credito_ia"("tipo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "compras_credito_ia_mpPaymentId_key" ON "compras_credito_ia"("mpPaymentId");

-- CreateIndex
CREATE INDEX "compras_credito_ia_contaId_createdAt_idx" ON "compras_credito_ia"("contaId", "createdAt");

-- CreateIndex
CREATE INDEX "compras_credito_ia_status_createdAt_idx" ON "compras_credito_ia"("status", "createdAt");

INSERT INTO "lotes_credito_ia" ("id", "contaId", "origem", "quantidadeInicial", "quantidadeRestante", "validoAte", "descricao", "chaveIdempotencia", "createdAt")
SELECT gen_random_uuid()::text, s."userId", 'MIGRACAO', 25, 25, NOW() + INTERVAL '365 days', 'Troca do add-on mensal da Skubo IA por pacote de perguntas', 'migracao-addon:' || s."userId", NOW()
FROM "subscriptions" s
WHERE (s."iaStatus" = 'ATIVA' OR s."mpPreapprovalIaId" IS NOT NULL)
ON CONFLICT ("chaveIdempotencia") DO NOTHING;

INSERT INTO "lotes_credito_ia" ("id", "contaId", "origem", "quantidadeInicial", "quantidadeRestante", "validoAte", "descricao", "chaveIdempotencia", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'TESTE', 5, 5, NOW() + INTERVAL '14 days', 'Perguntas grátis do teste', 'teste:' || u."id", NOW()
FROM "User" u
WHERE u."contaId" IS NULL
ON CONFLICT ("chaveIdempotencia") DO NOTHING;

INSERT INTO "movimentos_credito_ia" ("id", "contaId", "loteId", "tipo", "quantidade", "saldoApos", "descricao", "chaveIdempotencia", "createdAt")
SELECT gen_random_uuid()::text, l."contaId", l."id", 'ENTRADA', l."quantidadeInicial",
       SUM(l."quantidadeInicial") OVER (PARTITION BY l."contaId" ORDER BY l."createdAt", l."id"),
       COALESCE(l."descricao", 'Entrada de perguntas'), 'entrada:' || l."chaveIdempotencia", NOW()
FROM "lotes_credito_ia" l
WHERE NOT EXISTS (SELECT 1 FROM "movimentos_credito_ia" m WHERE m."loteId" = l."id")
ON CONFLICT ("chaveIdempotencia") DO NOTHING;
