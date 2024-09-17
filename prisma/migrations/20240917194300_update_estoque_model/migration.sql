/*
  Warnings:

  - You are about to drop the `Armazem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Estoque" DROP CONSTRAINT "Estoque_armazemId_fkey";

-- DropForeignKey
ALTER TABLE "Movimentacao" DROP CONSTRAINT "Movimentacao_armazemId_fkey";

-- DropTable
DROP TABLE "Armazem";
