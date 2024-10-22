-- CreateTable
CREATE TABLE "ProdutoFornecedor" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "fornecedorId" INTEGER NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "multiplicador" DOUBLE PRECISION NOT NULL,
    "codigoNF" TEXT,

    CONSTRAINT "ProdutoFornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoFornecedor_produtoId_fornecedorId_key" ON "ProdutoFornecedor"("produtoId", "fornecedorId");

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
