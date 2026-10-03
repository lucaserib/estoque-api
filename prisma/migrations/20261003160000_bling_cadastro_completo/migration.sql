CREATE TYPE "PrecoOrigem" AS ENUM ('BLING', 'MANUAL', 'ML');

CREATE TYPE "CustoOrigem" AS ENUM ('MANUAL', 'PEDIDO_COMPRA', 'BLING_FORNECEDOR', 'BLING_PRODUTO', 'PLANILHA');

CREATE TYPE "ArmazemTipo" AS ENUM ('LOCAL', 'FULL_ML', 'OUTRO');

ALTER TYPE "OrigemMovimentacaoEstoque" ADD VALUE 'SINCRONIZACAO_BLING';

ALTER TABLE "Produto" ADD COLUMN "custoOrigem" "CustoOrigem";
ALTER TABLE "Produto" ADD COLUMN "custoAtualizadoEm" TIMESTAMP(3);
ALTER TABLE "Produto" ADD COLUMN "precoVenda" INTEGER;
ALTER TABLE "Produto" ADD COLUMN "precoOrigem" "PrecoOrigem";
ALTER TABLE "Produto" ADD COLUMN "blingId" TEXT;

CREATE UNIQUE INDEX "Produto_userId_blingId_key" ON "Produto"("userId", "blingId");

ALTER TABLE "Armazem" ADD COLUMN "blingDepositoId" TEXT;
ALTER TABLE "Armazem" ADD COLUMN "tipo" "ArmazemTipo" NOT NULL DEFAULT 'LOCAL';

CREATE UNIQUE INDEX "Armazem_userId_blingDepositoId_key" ON "Armazem"("userId", "blingDepositoId");

ALTER TABLE "Fornecedor" ADD COLUMN "blingContatoId" TEXT;

CREATE UNIQUE INDEX "Fornecedor_userId_blingContatoId_key" ON "Fornecedor"("userId", "blingContatoId");

ALTER TABLE "bling_accounts" ADD COLUMN "ultimaSincronizacaoProdutos" TIMESTAMP(3);
ALTER TABLE "bling_accounts" ADD COLUMN "ultimaSincronizacaoEstoque" TIMESTAMP(3);
