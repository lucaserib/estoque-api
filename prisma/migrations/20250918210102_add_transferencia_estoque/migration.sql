-- CreateTable
CREATE TABLE "transferencias_estoque" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "armazemOrigemId" TEXT NOT NULL,
    "armazemDestinoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'concluida',

    CONSTRAINT "transferencias_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transferencia_itens" (
    "id" SERIAL NOT NULL,
    "transferenciaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "transferencia_itens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transferencias_estoque" ADD CONSTRAINT "transferencias_estoque_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_estoque" ADD CONSTRAINT "transferencias_estoque_armazemOrigemId_fkey" FOREIGN KEY ("armazemOrigemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencias_estoque" ADD CONSTRAINT "transferencias_estoque_armazemDestinoId_fkey" FOREIGN KEY ("armazemDestinoId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_itens" ADD CONSTRAINT "transferencia_itens_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "transferencias_estoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transferencia_itens" ADD CONSTRAINT "transferencia_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
