ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "gerarContaAPagarAoConfirmarCompra" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "prazoPagamentoPadraoDias" INTEGER NOT NULL DEFAULT 30;
