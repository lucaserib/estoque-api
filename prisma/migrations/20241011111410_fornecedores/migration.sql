-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "inscricaoEstadual" TEXT,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);
