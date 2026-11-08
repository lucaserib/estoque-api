ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SOLICITACAO_PLATAFORMA';

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "iaAtiva" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "iaAtivadaEm" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "iaSolicitadaEm" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "analises_ia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "notaDiagnostico" INTEGER NOT NULL,
    "conteudo" JSONB NOT NULL,
    "tokensEntrada" INTEGER,
    "tokensSaida" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analises_ia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analises_ia_userId_createdAt_idx" ON "analises_ia"("userId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "analises_ia" ADD CONSTRAINT "analises_ia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
