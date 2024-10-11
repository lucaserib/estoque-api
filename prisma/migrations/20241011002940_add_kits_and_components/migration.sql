/*
  Warnings:

  - You are about to drop the `Fornecedor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KitProduto` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PedidoCompra` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PedidoProduto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "KitProduto" DROP CONSTRAINT "KitProduto_kitId_fkey";

-- DropForeignKey
ALTER TABLE "KitProduto" DROP CONSTRAINT "KitProduto_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "PedidoCompra" DROP CONSTRAINT "PedidoCompra_fornecedorId_fkey";

-- DropForeignKey
ALTER TABLE "PedidoProduto" DROP CONSTRAINT "PedidoProduto_pedidoId_fkey";

-- DropForeignKey
ALTER TABLE "PedidoProduto" DROP CONSTRAINT "PedidoProduto_produtoId_fkey";

-- DropTable
DROP TABLE "Fornecedor";

-- DropTable
DROP TABLE "KitProduto";

-- DropTable
DROP TABLE "PedidoCompra";

-- DropTable
DROP TABLE "PedidoProduto";
