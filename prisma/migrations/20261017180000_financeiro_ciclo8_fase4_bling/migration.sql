ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "blingContasAtivo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "mapeamentos_categoria_bling" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blingCategoriaId" TEXT NOT NULL,
    "blingDescricao" TEXT NOT NULL,
    "categoriaFinanceiraId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapeamentos_categoria_bling_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mapeamentos_categoria_bling_userId_blingCategoriaId_key"
    ON "mapeamentos_categoria_bling"("userId", "blingCategoriaId");

ALTER TABLE "mapeamentos_categoria_bling" ADD CONSTRAINT "mapeamentos_categoria_bling_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mapeamentos_categoria_bling" ADD CONSTRAINT "mapeamentos_categoria_bling_categoriaFinanceiraId_fkey"
    FOREIGN KEY ("categoriaFinanceiraId") REFERENCES "categorias_financeiras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
