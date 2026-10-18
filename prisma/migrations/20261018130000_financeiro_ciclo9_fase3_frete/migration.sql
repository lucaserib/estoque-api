DO $$ BEGIN
    CREATE TYPE "FreteOrigem" AS ENUM ('AJUSTE_MANUAL', 'PAGAMENTO_CONFIRMADO', 'CUSTO_ENVIO_CANAL', 'CUSTO_PRODUTO', 'PADRAO_LOGISTICA', 'DESCONHECIDO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TipoValorFreteLogistica" AS ENUM ('FIXO', 'PERCENTUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "freteOrigem" "FreteOrigem" NOT NULL DEFAULT 'DESCONHECIDO';
ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "freteAjusteManual" INTEGER;
ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "freteAjusteManualMotivo" TEXT;
ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "freteAjusteManualUserId" TEXT;
ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "freteAjusteManualEm" TIMESTAMP(3);

ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "custoFreteManual" INTEGER;
ALTER TABLE "Produto" ADD COLUMN IF NOT EXISTS "custoEmbalagem" INTEGER;

CREATE TABLE IF NOT EXISTS "regras_frete_logistica" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "logistica"  TEXT NOT NULL,
    "tipoValor"  "TipoValorFreteLogistica" NOT NULL,
    "valor"      INTEGER NOT NULL DEFAULT 0,
    "percentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_frete_logistica_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "regras_frete_logistica_userId_logistica_key"
    ON "regras_frete_logistica"("userId", "logistica");

DO $$ BEGIN
    ALTER TABLE "regras_frete_logistica" ADD CONSTRAINT "regras_frete_logistica_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
