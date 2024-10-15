/*
  Warnings:

  - You are about to drop the column `quantidade` on the `Saida` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Saida" DROP CONSTRAINT "Saida_produtoId_fkey";

-- AlterTable
ALTER TABLE "Saida" DROP COLUMN "quantidade",
ALTER COLUMN "produtoId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DetalhesSaida" (
    "id" SERIAL NOT NULL,
    "saidaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "isKit" BOOLEAN NOT NULL,

    CONSTRAINT "DetalhesSaida_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Saida" ADD CONSTRAINT "Saida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_saidaId_fkey" FOREIGN KEY ("saidaId") REFERENCES "Saida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
