-- CreateTable
CREATE TABLE "KitProduto" (
    "id" SERIAL NOT NULL,
    "kitId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "KitProduto_pkey" PRIMARY KEY ("id")
);
