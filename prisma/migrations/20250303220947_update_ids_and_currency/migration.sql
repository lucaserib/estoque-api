/*
  Warnings:

  - The primary key for the `Armazem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Estoque` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Fornecedor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `custo` on the `PedidoProduto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - The primary key for the `Produto` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `custoMedio` on the `Produto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `preco` on the `ProdutoFornecedor` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - The primary key for the `Saida` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Componente" DROP CONSTRAINT "Componente_kitId_fkey";

-- DropForeignKey
ALTER TABLE "Componente" DROP CONSTRAINT "Componente_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "DetalhesSaida" DROP CONSTRAINT "DetalhesSaida_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "DetalhesSaida" DROP CONSTRAINT "DetalhesSaida_saidaId_fkey";

-- DropForeignKey
ALTER TABLE "Estoque" DROP CONSTRAINT "Estoque_armazemId_fkey";

-- DropForeignKey
ALTER TABLE "Estoque" DROP CONSTRAINT "Estoque_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "PedidoCompra" DROP CONSTRAINT "PedidoCompra_fornecedorId_fkey";

-- DropForeignKey
ALTER TABLE "PedidoProduto" DROP CONSTRAINT "PedidoProduto_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoFornecedor" DROP CONSTRAINT "ProdutoFornecedor_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "Saida" DROP CONSTRAINT "Saida_armazemId_fkey";

-- DropForeignKey
ALTER TABLE "Saida" DROP CONSTRAINT "Saida_produtoId_fkey";

-- AlterTable
ALTER TABLE "Armazem" DROP CONSTRAINT "Armazem_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Armazem_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Armazem_id_seq";

-- AlterTable
ALTER TABLE "Componente" ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "kitId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "DetalhesSaida" ALTER COLUMN "saidaId" SET DATA TYPE TEXT,
ALTER COLUMN "produtoId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Estoque" DROP CONSTRAINT "Estoque_pkey",
ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "armazemId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Estoque_pkey" PRIMARY KEY ("produtoId", "armazemId");

-- AlterTable
ALTER TABLE "Fornecedor" DROP CONSTRAINT "Fornecedor_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Fornecedor_id_seq";

-- AlterTable
ALTER TABLE "PedidoCompra" ALTER COLUMN "fornecedorId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "PedidoProduto" ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "custo" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "custoMedio" SET DEFAULT 0,
ALTER COLUMN "custoMedio" SET DATA TYPE INTEGER,
ADD CONSTRAINT "Produto_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Produto_id_seq";

-- AlterTable
ALTER TABLE "ProdutoFornecedor" ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ALTER COLUMN "fornecedorId" SET DATA TYPE TEXT,
ALTER COLUMN "preco" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Saida" DROP CONSTRAINT "Saida_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "armazemId" SET DATA TYPE TEXT,
ALTER COLUMN "produtoId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Saida_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Saida_id_seq";

-- AddForeignKey
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saida" ADD CONSTRAINT "Saida_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Saida" ADD CONSTRAINT "Saida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalhesSaida" ADD CONSTRAINT "DetalhesSaida_saidaId_fkey" FOREIGN KEY ("saidaId") REFERENCES "Saida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoProduto" ADD CONSTRAINT "PedidoProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedor" ADD CONSTRAINT "ProdutoFornecedor_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
