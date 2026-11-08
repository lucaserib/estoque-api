CREATE TABLE IF NOT EXISTS "notas_fiscais_venda" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blingNotaId" TEXT NOT NULL,
    "numero" TEXT,
    "serie" TEXT,
    "chaveAcesso" TEXT,
    "situacao" INTEGER NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "valorNota" INTEGER NOT NULL,
    "valorFrete" INTEGER NOT NULL DEFAULT 0,
    "numeroPedidoLoja" TEXT,
    "vendaCanalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_fiscais_venda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notas_fiscais_venda_userId_blingNotaId_key" ON "notas_fiscais_venda"("userId", "blingNotaId");
CREATE INDEX IF NOT EXISTS "notas_fiscais_venda_userId_dataEmissao_idx" ON "notas_fiscais_venda"("userId", "dataEmissao");
CREATE INDEX IF NOT EXISTS "notas_fiscais_venda_userId_numeroPedidoLoja_idx" ON "notas_fiscais_venda"("userId", "numeroPedidoLoja");

DO $$ BEGIN
    ALTER TABLE "notas_fiscais_venda" ADD CONSTRAINT "notas_fiscais_venda_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "notas_fiscais_venda" ADD CONSTRAINT "notas_fiscais_venda_vendaCanalId_fkey" FOREIGN KEY ("vendaCanalId") REFERENCES "vendas_canal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
