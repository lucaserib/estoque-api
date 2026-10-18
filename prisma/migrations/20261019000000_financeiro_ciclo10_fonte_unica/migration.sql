DO $$ BEGIN
  CREATE TYPE "ModoFaturamento" AS ENUM ('PRODUTOS', 'PRODUTOS_E_FRETE_COMPRADOR', 'PRODUTOS_MENOS_FRETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "modoFaturamento" "ModoFaturamento" NOT NULL DEFAULT 'PRODUTOS';

ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "valorEstornado" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "enriquecidoEm" TIMESTAMP(3);
ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "enriquecimentoTentativas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "enriquecimentoErro" TEXT;
CREATE INDEX IF NOT EXISTS "vendas_canal_contaCanalId_enriquecidoEm_idx" ON "vendas_canal"("contaCanalId", "enriquecidoEm");

UPDATE "vendas_canal" SET "enriquecidoEm" = "updatedAt"
WHERE "enriquecidoEm" IS NULL AND "freteOrigem" IN ('PAGAMENTO_CONFIRMADO', 'AJUSTE_MANUAL');

ALTER TABLE "mercado_livre_accounts" ADD COLUMN IF NOT EXISTS "financeiroProcessandoAte" TIMESTAMP(3);
ALTER TABLE "mercado_livre_accounts" ADD COLUMN IF NOT EXISTS "versaoDadosFinanceiros" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "sincronizacoes_catalogo" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "etapa" TEXT,
  "cursor" JSONB,
  "progresso" JSONB,
  "iniciadoEm" TIMESTAMP(3),
  "concluidoEm" TIMESTAMP(3),
  "processandoAte" TIMESTAMP(3),
  "erro" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sincronizacoes_catalogo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sincronizacoes_catalogo_userId_key" ON "sincronizacoes_catalogo"("userId");
