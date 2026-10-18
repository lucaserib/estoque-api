ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "retencaoDividas" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "vendas_canal" ADD COLUMN IF NOT EXISTS "statusLiberacao" TEXT;

CREATE TABLE IF NOT EXISTS "cobrancas_pagamento" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "pagamentoExternoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "estornado" INTEGER NOT NULL DEFAULT 0,
    "destino" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobrancas_pagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cobrancas_pagamento_vendaId_pagamentoExternoId_nome_key"
    ON "cobrancas_pagamento"("vendaId", "pagamentoExternoId", "nome");

CREATE INDEX IF NOT EXISTS "cobrancas_pagamento_vendaId_idx" ON "cobrancas_pagamento"("vendaId");

ALTER TABLE "cobrancas_pagamento" ADD CONSTRAINT "cobrancas_pagamento_vendaId_fkey"
    FOREIGN KEY ("vendaId") REFERENCES "vendas_canal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
