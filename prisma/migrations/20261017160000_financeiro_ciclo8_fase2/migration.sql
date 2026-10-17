ALTER TABLE "mercado_livre_accounts" ADD COLUMN IF NOT EXISTS "ultimaSincronizacaoFinanceiraEm" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "sincronizacoes_financeiras_erros" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canal" "CanalVenda" NOT NULL,
    "pedidoExternoId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "ultimoErroEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "sincronizacoes_financeiras_erros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sincronizacoes_financeiras_erros_userId_canal_pedidoExtern_key"
    ON "sincronizacoes_financeiras_erros"("userId", "canal", "pedidoExternoId", "etapa");

CREATE INDEX IF NOT EXISTS "sincronizacoes_financeiras_erros_userId_canal_resolvidoEm_idx"
    ON "sincronizacoes_financeiras_erros"("userId", "canal", "resolvidoEm");

ALTER TABLE "sincronizacoes_financeiras_erros" ADD CONSTRAINT "sincronizacoes_financeiras_erros_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
