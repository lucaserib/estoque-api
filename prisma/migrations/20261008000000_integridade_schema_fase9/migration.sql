-- Ciclo 6 Fase 9: integridade do schema (unique, onDelete coerente, índices em FKs de userId/contaId)

-- Componente: evita duas linhas para o mesmo par kit+componente; cascade
-- quando o kit ou o componente forem excluídos.
-- ATENÇÃO antes de aplicar em produção: se já existirem pares duplicados
-- (mesmo kitId + produtoId), este ADD CONSTRAINT falha. Rode antes:
--   SELECT "kitId", "produtoId", COUNT(*) FROM "Componente"
--   GROUP BY "kitId", "produtoId" HAVING COUNT(*) > 1;
-- e resolva as duplicatas manualmente antes de rodar esta migração.
ALTER TABLE "Componente" DROP CONSTRAINT "Componente_produtoId_fkey";
ALTER TABLE "Componente" DROP CONSTRAINT "Componente_kitId_fkey";
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Componente_kitId_produtoId_key" ON "Componente"("kitId", "produtoId");

-- Estoque: remover um produto ou armazém remove as linhas de saldo associadas.
ALTER TABLE "Estoque" DROP CONSTRAINT "Estoque_produtoId_fkey";
ALTER TABLE "Estoque" DROP CONSTRAINT "Estoque_armazemId_fkey";
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DetalhesSaida: linha de detalhe não sobrevive sem a saída ou o produto.
ALTER TABLE "DetalhesSaida" DROP CONSTRAINT "DetalhesSaida_saidaId_fkey";
ALTER TABLE "DetalhesSaida" DROP CONSTRAINT "DetalhesSaida_produtoId_fkey";
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_saidaId_fkey" FOREIGN KEY ("saidaId") REFERENCES "Saida"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PedidoProduto: linha do pedido não sobrevive sem o pedido ou o produto.
ALTER TABLE "PedidoProduto" DROP CONSTRAINT "PedidoProduto_pedidoId_fkey";
ALTER TABLE "PedidoProduto" DROP CONSTRAINT "PedidoProduto_produtoId_fkey";
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProdutoFornecedor: vínculo não sobrevive sem o fornecedor ou o produto.
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey";
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT "ProdutoFornecedor_produtoId_fkey";
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nota: "Saida_produtoId_fkey" já é ON DELETE SET NULL desde a migração
-- inicial (correto para um relacionamento opcional) — nada a mudar ali.

-- Índices em FKs de userId/contaId que ainda não tinham nenhum índice
-- aproveitável (coluna líder de algum @@unique já existente foi mantida
-- como está, sem duplicar).
CREATE INDEX "User_contaId_idx" ON "User"("contaId");
CREATE INDEX "estoque_movimentacoes_userId_idx" ON "estoque_movimentacoes"("userId");
CREATE INDEX "Saida_userId_idx" ON "Saida"("userId");
CREATE INDEX "PedidoCompra_userId_idx" ON "PedidoCompra"("userId");
CREATE INDEX "transferencias_estoque_userId_idx" ON "transferencias_estoque"("userId");
CREATE INDEX "bling_accounts_userId_idx" ON "bling_accounts"("userId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
