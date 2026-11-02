-- AlterEnum: novo modo de faturamento "igual ao Bling/Mercado Turbo" (produtos + frete total)
ALTER TYPE "ModoFaturamento" ADD VALUE IF NOT EXISTS 'PRODUTOS_E_FRETE_TOTAL';

-- CreateTable
CREATE TABLE IF NOT EXISTS "onboarding_progresso" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "etapasPuladas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tourVisto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "onboarding_progresso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progresso_userId_key" ON "onboarding_progresso"("userId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "onboarding_progresso" ADD CONSTRAINT "onboarding_progresso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
