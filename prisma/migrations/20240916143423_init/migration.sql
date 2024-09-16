/*
  Warnings:

  - You are about to drop the column `dataPedido` on the `PedidoCompra` table. All the data in the column will be lost.
  - You are about to drop the column `dataRecebimento` on the `PedidoCompra` table. All the data in the column will be lost.
  - You are about to drop the column `produtoId` on the `PedidoCompra` table. All the data in the column will be lost.
  - You are about to drop the column `quantidade` on the `PedidoCompra` table. All the data in the column will be lost.
  - You are about to drop the column `recebido` on the `PedidoCompra` table. All the data in the column will be lost.
  - You are about to drop the column `fornecedorId` on the `Produto` table. All the data in the column will be lost.
  - You are about to drop the column `quantidade` on the `Produto` table. All the data in the column will be lost.
  - Added the required column `valorTotal` to the `Movimentacao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fornecedorId` to the `PedidoCompra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `PedidoCompra` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PedidoCompra" DROP CONSTRAINT "PedidoCompra_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_fornecedorId_fkey";

-- DropIndex
DROP INDEX "Produto_sku_key";

-- AlterTable
ALTER TABLE "Fornecedor" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "inscricaoEstadual" TEXT;

-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "valorTotal" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "PedidoCompra" DROP COLUMN "dataPedido",
DROP COLUMN "dataRecebimento",
DROP COLUMN "produtoId",
DROP COLUMN "quantidade",
DROP COLUMN "recebido",
ADD COLUMN     "comentarios" TEXT,
ADD COLUMN     "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fornecedorId" INTEGER NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Produto" DROP COLUMN "fornecedorId",
DROP COLUMN "quantidade";

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
CREATE TABLE "Estoque" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "armazem" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "Estoque_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
