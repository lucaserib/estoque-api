CREATE TYPE "OrigemMovimentacaoEstoque" AS ENUM ('IMPORTACAO_PLANILHA', 'AJUSTE_MANUAL', 'SINCRONIZACAO_FULL_ML');

CREATE TABLE "estoque_movimentacoes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "armazemId" TEXT NOT NULL,
    "quantidadeAnterior" INTEGER NOT NULL,
    "quantidadeNova" INTEGER NOT NULL,
    "origem" "OrigemMovimentacaoEstoque" NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estoque_movimentacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "estoque_movimentacoes_produtoId_armazemId_idx" ON "estoque_movimentacoes"("produtoId", "armazemId");

ALTER TABLE "estoque_movimentacoes" ADD CONSTRAINT "estoque_movimentacoes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "estoque_movimentacoes" ADD CONSTRAINT "estoque_movimentacoes_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "estoque_movimentacoes" ADD CONSTRAINT "estoque_movimentacoes_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
