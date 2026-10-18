ALTER TABLE "contas_financeiras" ADD COLUMN IF NOT EXISTS "automatica" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contas_financeiras" ADD COLUMN IF NOT EXISTS "contaCanalId" TEXT;
ALTER TABLE "contas_financeiras" ADD COLUMN IF NOT EXISTS "saldoAtualExterno" INTEGER;
ALTER TABLE "contas_financeiras" ADD COLUMN IF NOT EXISTS "saldoALiberarExterno" INTEGER;
ALTER TABLE "contas_financeiras" ADD COLUMN IF NOT EXISTS "saldoExternoAtualizadoEm" TIMESTAMP(3);
ALTER TABLE "contas_financeiras" ADD COLUMN IF NOT EXISTS "saldoExternoConfianca" "Confianca";

CREATE UNIQUE INDEX IF NOT EXISTS "contas_financeiras_userId_contaCanalId_key"
    ON "contas_financeiras"("userId", "contaCanalId");
