/*
  Warnings:

  - You are about to drop the column `valorUnitario` on the `Estoque` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Estoque" DROP COLUMN "valorUnitario";

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "custoMedio" DOUBLE PRECISION DEFAULT 0;
