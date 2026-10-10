-- Ciclo 6 Fase 9: integridade do schema (unique, onDelete coerente, índices em FKs de userId/contaId)
-- Idempotente por segurança: todo DROP CONSTRAINT usa IF EXISTS e todo
-- CREATE INDEX usa IF NOT EXISTS, para que reaplicar este arquivo nunca
-- falhe por objeto já existente, independente do estado atual do banco.

-- Componente: evita duas linhas para o mesmo par kit+componente; cascade
-- quando o kit ou o componente forem excluídos.
ALTER TABLE "Componente" DROP CONSTRAINT IF EXISTS "Componente_produtoId_fkey";
ALTER TABLE "Componente" DROP CONSTRAINT IF EXISTS "Componente_kitId_fkey";
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O índice único abaixo só é criado se não houver pares (kitId, produtoId)
-- duplicados. Se houver, a migração NÃO falha e NÃO toca em nenhum dado —
-- só avisa via RAISE NOTICE quantos pares duplicados existem. Resolva as
-- duplicatas manualmente e rode esta migração de novo (idempotente) para
-- criar o índice.
DO $$
DECLARE
  pares_duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO pares_duplicados
  FROM (
    SELECT "kitId", "produtoId"
    FROM "Componente"
    GROUP BY "kitId", "produtoId"
    HAVING COUNT(*) > 1
  ) AS duplicados;

  IF pares_duplicados > 0 THEN
    RAISE NOTICE 'Componente: % par(es) duplicado(s) de (kitId, produtoId) — índice único NÃO criado. Resolva as duplicatas e rode a migração de novo.', pares_duplicados;
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Componente_kitId_produtoId_key'
  ) THEN
    CREATE UNIQUE INDEX "Componente_kitId_produtoId_key" ON "Componente"("kitId", "produtoId");
  END IF;
END $$;

-- Estoque: remover um produto ou armazém remove as linhas de saldo associadas.
ALTER TABLE "Estoque" DROP CONSTRAINT IF EXISTS "Estoque_produtoId_fkey";
ALTER TABLE "Estoque" DROP CONSTRAINT IF EXISTS "Estoque_armazemId_fkey";
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DetalhesSaida: linha de detalhe não sobrevive sem a saída ou o produto.
ALTER TABLE "DetalhesSaida" DROP CONSTRAINT IF EXISTS "DetalhesSaida_saidaId_fkey";
ALTER TABLE "DetalhesSaida" DROP CONSTRAINT IF EXISTS "DetalhesSaida_produtoId_fkey";
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_saidaId_fkey" FOREIGN KEY ("saidaId") REFERENCES "Saida"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PedidoProduto: linha do pedido não sobrevive sem o pedido ou o produto.
ALTER TABLE "PedidoProduto" DROP CONSTRAINT IF EXISTS "PedidoProduto_pedidoId_fkey";
ALTER TABLE "PedidoProduto" DROP CONSTRAINT IF EXISTS "PedidoProduto_produtoId_fkey";
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProdutoFornecedor: vínculo não sobrevive sem o fornecedor ou o produto.
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT IF EXISTS "ProdutoFornecedor_fornecedorId_fkey";
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT IF EXISTS "ProdutoFornecedor_produtoId_fkey";
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nota: "Saida_produtoId_fkey" já é ON DELETE SET NULL desde a migração
-- inicial (correto para um relacionamento opcional) — nada a mudar ali.

-- Índices em FKs de userId/contaId que ainda não tinham nenhum índice
-- aproveitável (coluna líder de algum @@unique já existente foi mantida
-- como está, sem duplicar). "User_contaId_idx" NÃO entra aqui: já é criado
-- pela migração 20261003180000_user_conta_id (Ciclo 6 Fase 4) — recriá-lo
-- aqui era redundante e foi o que causou o P3018 original desta migração.
CREATE INDEX IF NOT EXISTS "estoque_movimentacoes_userId_idx" ON "estoque_movimentacoes"("userId");
CREATE INDEX IF NOT EXISTS "Saida_userId_idx" ON "Saida"("userId");
CREATE INDEX IF NOT EXISTS "PedidoCompra_userId_idx" ON "PedidoCompra"("userId");
CREATE INDEX IF NOT EXISTS "transferencias_estoque_userId_idx" ON "transferencias_estoque"("userId");
CREATE INDEX IF NOT EXISTS "bling_accounts_userId_idx" ON "bling_accounts"("userId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
