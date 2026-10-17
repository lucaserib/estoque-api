ALTER TABLE "vendas_canal_itens" ADD COLUMN IF NOT EXISTS "descontoCusteadoMl" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "diasLiberacaoPadrao" INTEGER NOT NULL DEFAULT 14;
