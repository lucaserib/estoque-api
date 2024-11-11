-- CreateTable
CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "isKit" BOOLEAN NOT NULL DEFAULT false,
    "ean" BIGINT,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Componente" (
    "id" SERIAL NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "kitId" INTEGER NOT NULL,

    CONSTRAINT "Componente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estoque" (
    "produtoId" INTEGER NOT NULL,
    "armazemId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DOUBLE PRECISION NOT NULL,
    "estoqueSeguranca" INTEGER,

    CONSTRAINT "Estoque_pkey" PRIMARY KEY ("produtoId","armazemId")
);

-- CreateTable
CREATE TABLE "Saida" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "armazemId" INTEGER NOT NULL,
    "produtoId" INTEGER,

    CONSTRAINT "Saida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalhesSaida" (
    "id" SERIAL NOT NULL,
    "saidaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "isKit" BOOLEAN NOT NULL,

    CONSTRAINT "DetalhesSaida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Armazem" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Armazem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "inscricaoEstadual" TEXT,
    "contato" TEXT,
    "endereco" TEXT,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" SERIAL NOT NULL,
    "fornecedorId" INTEGER NOT NULL,
    "comentarios" TEXT,
    "status" TEXT NOT NULL,
    "armazemId" INTEGER,
    "dataPrevista" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),

    CONSTRAINT "PedidoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoProduto" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "custo" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PedidoProduto_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "Produto_sku_key" ON "Produto"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoFornecedor_produtoId_fornecedorId_key" ON "ProdutoFornecedor"("produtoId", "fornecedorId");

-- AddForeignKey
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saida" ADD CONSTRAINT "Saida_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saida" ADD CONSTRAINT "Saida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_saidaId_fkey" FOREIGN KEY ("saidaId") REFERENCES "Saida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
