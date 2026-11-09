-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INDICACAO';

-- CreateEnum
CREATE TYPE "StatusIndicacao" AS ENUM ('CADASTRADO', 'ATIVADO', 'PAGOU', 'EM_CARENCIA', 'RECOMPENSADA', 'INVALIDADA');

-- CreateEnum
CREATE TYPE "OrigemCreditoDias" AS ENUM ('INDICACAO', 'ADMIN', 'CUPOM');

-- CreateEnum
CREATE TYPE "FormaCreditoDias" AS ENUM ('EXTENSAO_TESTE', 'DESCONTO_PROXIMA_COBRANCA', 'CICLO_PAUSADO', 'EXTENSAO_ANUAL', 'PENDENTE');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "descontoAplicadoCentavos" INTEGER,
ADD COLUMN     "pausadaAte" TIMESTAMP(3),
ADD COLUMN     "proximaCobrancaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "indicacoes" (
    "id" TEXT NOT NULL,
    "indicadorContaId" TEXT NOT NULL,
    "indicadoContaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "status" "StatusIndicacao" NOT NULL DEFAULT 'CADASTRADO',
    "motivoInvalidacao" TEXT,
    "pagamentoId" TEXT,
    "diasRecompensa" INTEGER NOT NULL,
    "carenciaAte" TIMESTAMP(3),
    "aprovadaManualmentePor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativadoEm" TIMESTAMP(3),
    "pagouEm" TIMESTAMP(3),
    "recompensadaEm" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "indicacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_dias_assinatura" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,
    "origem" "OrigemCreditoDias" NOT NULL,
    "indicacaoId" TEXT,
    "forma" "FormaCreditoDias" NOT NULL DEFAULT 'PENDENTE',
    "aplicadoEm" TIMESTAMP(3),
    "descricao" TEXT,
    "detalhe" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creditos_dias_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indicacoes_indicadoContaId_key" ON "indicacoes"("indicadoContaId");

-- CreateIndex
CREATE INDEX "indicacoes_indicadorContaId_status_idx" ON "indicacoes"("indicadorContaId", "status");

-- CreateIndex
CREATE INDEX "indicacoes_status_carenciaAte_idx" ON "indicacoes"("status", "carenciaAte");

-- CreateIndex
CREATE UNIQUE INDEX "creditos_dias_assinatura_indicacaoId_key" ON "creditos_dias_assinatura"("indicacaoId");

-- CreateIndex
CREATE INDEX "creditos_dias_assinatura_contaId_forma_idx" ON "creditos_dias_assinatura"("contaId", "forma");
