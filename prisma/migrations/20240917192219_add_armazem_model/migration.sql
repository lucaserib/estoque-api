-- CreateTable
CREATE TABLE "Armazem" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Armazem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Estoque" ADD CONSTRAINT "Estoque_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_armazemId_fkey" FOREIGN KEY ("armazemId") REFERENCES "Armazem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
