DO $$ BEGIN
  CREATE TYPE "TipoTarefaSincronizacao" AS ENUM ('PEDIDOS_PERIODO', 'PEDIDOS_INCREMENTAL', 'ADS', 'COBRANCAS', 'PAGAMENTOS', 'PRODUTOS_ML', 'BLING_PRODUTOS', 'BLING_ESTOQUE', 'BLING_CONTAS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusTarefaSincronizacao" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'ERRO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "tarefas_sincronizacao_financeira" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canal" "CanalVenda" NOT NULL,
    "contaCanalId" TEXT NOT NULL,
    "tipo" "TipoTarefaSincronizacao" NOT NULL,
    "desde" TIMESTAMP(3),
    "ate" TIMESTAMP(3),
    "cursor" JSONB,
    "status" "StatusTarefaSincronizacao" NOT NULL DEFAULT 'PENDENTE',
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "processados" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "erro" TEXT,
    "bloqueadaAte" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "tarefas_sincronizacao_financeira_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tarefas_sincronizacao_financeira_userId_contaCanalId_statu_idx"
    ON "tarefas_sincronizacao_financeira"("userId", "contaCanalId", "status", "prioridade");

ALTER TABLE "tarefas_sincronizacao_financeira" ADD CONSTRAINT "tarefas_sincronizacao_financeira_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
