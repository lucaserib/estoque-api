/*
  Warnings:

  - Added the required column `armazemId` to the `Movimentacao` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "armazemId" INTEGER NOT NULL;
