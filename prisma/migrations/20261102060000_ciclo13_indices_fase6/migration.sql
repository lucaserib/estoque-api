-- DropIndex: substituído por um índice composto que também cobre `status`
-- (usado por valorALiberarNoDia, chamada a cada carregamento do cartão "Hoje").
DROP INDEX IF EXISTS "vendas_canal_userId_dataLiberacao_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendas_canal_userId_dataLiberacao_status_idx" ON "vendas_canal"("userId", "dataLiberacao", "status");

-- CreateIndex: cobre somarCobrancas (motor.ts), chamada em toda tela do Financeiro —
-- filtra por userId + intervalo de data + coberturaPedido=false e não tinha índice.
CREATE INDEX IF NOT EXISTS "cobrancas_canal_userId_data_coberturaPedido_idx" ON "cobrancas_canal"("userId", "data", "coberturaPedido");
