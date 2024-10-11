/*
  Warnings:

  - Added the required column `valorUnitario` to the `Estoque` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Estoque" ADD COLUMN     "valorUnitario" DOUBLE PRECISION NOT NULL;
