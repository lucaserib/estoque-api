-- CreateTable
CREATE TABLE "Componente" (
    "id" SERIAL NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "kitId" INTEGER NOT NULL,

    CONSTRAINT "Componente_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Componente" ADD CONSTRAINT "Componente_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
