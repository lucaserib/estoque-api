/*
  Warnings:

  - Added the required column `armazemId` to the `Saida` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Saida" ADD COLUMN     "armazemId" INTEGER NOT NULL;
