-- AlterTable
ALTER TABLE "Estoque" ALTER COLUMN "valorUnitario" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PedidoCompra" ADD COLUMN     "armazemId" INTEGER;
