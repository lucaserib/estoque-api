-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TemaPreferencia" AS ENUM ('CLARO', 'ESCURO', 'SISTEMA');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: personalização por conta (Ciclo 13 Fase 1 — nome/logo da loja e tema)
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "nomeLoja" TEXT;
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "tema" "TemaPreferencia" NOT NULL DEFAULT 'SISTEMA';
