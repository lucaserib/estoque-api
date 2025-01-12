/*
  Warnings:

  - Added the required column `userId` to the `Armazem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Fornecedor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PedidoCompra` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Produto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Saida` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Armazem" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Fornecedor" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PedidoCompra" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Saida" ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saida" ADD CONSTRAINT "Saida_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Armazem" ADD CONSTRAINT "Armazem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
