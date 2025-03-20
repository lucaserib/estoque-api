/*
  Warnings:

  - A unique constraint covering the columns `[sku,userId]` on the table `Produto` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Produto_sku_key";

-- CreateIndex
CREATE UNIQUE INDEX "Produto_sku_userId_key" ON "Produto"("sku", "userId");
