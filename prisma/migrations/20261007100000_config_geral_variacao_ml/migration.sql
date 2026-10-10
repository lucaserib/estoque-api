-- ConfiguracaoGeral (alíquota de imposto por conta)
CREATE TABLE "configuracoes_gerais" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aliquotaImposto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgDeliveryDaysPadrao" INTEGER NOT NULL DEFAULT 7,
    "ultimaContagemPendenciasCriticas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_gerais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "configuracoes_gerais_userId_key" ON "configuracoes_gerais"("userId");

ALTER TABLE "configuracoes_gerais" ADD CONSTRAINT "configuracoes_gerais_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NotificationType: CADASTRO_INCOMPLETO
ALTER TYPE "NotificationType" ADD VALUE 'CADASTRO_INCOMPLETO';

-- ProdutoMercadoLivre: mlVariationId (preparação para suporte a variações)
ALTER TABLE "produtos_mercado_livre" ADD COLUMN "mlVariationId" TEXT;
