DO $$ BEGIN
    CREATE TYPE "OrigemVinculoProduto" AS ENUM ('SKU_EXATO', 'EAN', 'SIMILARIDADE', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "produtos_mercado_livre" ADD COLUMN IF NOT EXISTS "vinculoOrigem" "OrigemVinculoProduto";
ALTER TABLE "produtos_mercado_livre" ADD COLUMN IF NOT EXISTS "vinculoConfirmado" BOOLEAN NOT NULL DEFAULT true;
