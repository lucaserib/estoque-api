/*
  Warnings:

  - The primary key for the `Estoque` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Estoque` table. All the data in the column will be lost.
  - You are about to drop the column `valorUnitario` on the `Estoque` table. All the data in the column will be lost.
  - You are about to drop the `Movimentacao` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[sku]` on the table `Produto` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Movimentacao" DROP CONSTRAINT "Movimentacao_fornecedorId_fkey";

-- DropForeignKey
ALTER TABLE "Movimentacao" DROP CONSTRAINT "Movimentacao_produtoId_fkey";

-- AlterTable
ALTER TABLE "Estoque" DROP CONSTRAINT "Estoque_pkey",
DROP COLUMN "id",
DROP COLUMN "valorUnitario",
ADD CONSTRAINT "Estoque_pkey" PRIMARY KEY ("produtoId", "armazemId");

-- DropTable
DROP TABLE "Movimentacao";

-- CreateIndex
CREATE UNIQUE INDEX "Produto_sku_key" ON "Produto"("sku");
