/*
  Warnings:

  - You are about to drop the column `armazem` on the `Estoque` table. All the data in the column will be lost.
  - Added the required column `armazemId` to the `Estoque` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Estoque" DROP COLUMN "armazem",
ADD COLUMN     "armazemId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "fornecedorId" INTEGER;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
