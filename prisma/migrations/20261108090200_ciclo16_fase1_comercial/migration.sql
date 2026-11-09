-- CreateEnum
CREATE TYPE "TipoCupom" AS ENUM ('PERCENTUAL', 'FIXO');

-- CreateEnum
CREATE TYPE "AlvoCupom" AS ENUM ('PRIMEIRA_COBRANCA_MENSAL', 'ANUAL', 'PACOTE_IA');

-- CreateEnum
CREATE TYPE "StatusReajuste" AS ENUM ('AGENDADO', 'APLICADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "configuracaoVersao" INTEGER,
ADD COLUMN     "cupomPrimeiraCobrancaId" TEXT,
ADD COLUMN     "precoContratadoCentavos" INTEGER;

-- CreateTable
CREATE TABLE "configuracoes_comerciais" (
    "id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaPor" TEXT NOT NULL,
    "observacao" TEXT,
    "diasTeste" INTEGER NOT NULL,
    "precoMensalCentavos" INTEGER NOT NULL,
    "precoPrimeiroMesCentavos" INTEGER,
    "precoAnualCentavos" INTEGER NOT NULL,
    "iaPerguntasTeste" INTEGER NOT NULL,
    "iaValidadeDiasTeste" INTEGER NOT NULL,
    "iaValidadeDiasCompra" INTEGER NOT NULL,
    "iaPacotes" JSONB NOT NULL,
    "iaPesoPorRecurso" JSONB NOT NULL,
    "iaExplicacoesGratisPorDia" INTEGER NOT NULL,
    "iaResumoSemanalSoAssinantes" BOOLEAN NOT NULL,
    "indicacao" JSONB NOT NULL,
    "limiteUsuariosPorConta" INTEGER,
    "textosOferta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracoes_comerciais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupons" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoCupom" NOT NULL,
    "valor" INTEGER NOT NULL,
    "alvo" "AlvoCupom" NOT NULL,
    "usosMaximos" INTEGER,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "validoAte" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usos_cupom" (
    "id" TEXT NOT NULL,
    "cupomId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "referencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usos_cupom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reajustes_assinatura" (
    "id" TEXT NOT NULL,
    "plano" "SubscriptionPlan" NOT NULL,
    "novoPrecoCentavos" INTEGER NOT NULL,
    "aplicarEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusReajuste" NOT NULL DEFAULT 'AGENDADO',
    "motivo" TEXT NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "afetados" INTEGER NOT NULL DEFAULT 0,
    "avisados" INTEGER NOT NULL DEFAULT 0,
    "aplicados" INTEGER NOT NULL DEFAULT 0,
    "falhas" INTEGER NOT NULL DEFAULT 0,
    "aplicadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reajustes_assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_comerciais_versao_key" ON "configuracoes_comerciais"("versao");

-- CreateIndex
CREATE UNIQUE INDEX "cupons_codigo_key" ON "cupons"("codigo");

-- CreateIndex
CREATE INDEX "usos_cupom_contaId_idx" ON "usos_cupom"("contaId");

-- CreateIndex
CREATE UNIQUE INDEX "usos_cupom_cupomId_contaId_key" ON "usos_cupom"("cupomId", "contaId");

-- CreateIndex
CREATE INDEX "reajustes_assinatura_status_aplicarEm_idx" ON "reajustes_assinatura"("status", "aplicarEm");

-- AddForeignKey
ALTER TABLE "usos_cupom" ADD CONSTRAINT "usos_cupom_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "cupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "configuracoes_comerciais" (
  "id", "versao", "vigenteDesde", "criadaPor", "observacao",
  "diasTeste", "precoMensalCentavos", "precoPrimeiroMesCentavos", "precoAnualCentavos",
  "iaPerguntasTeste", "iaValidadeDiasTeste", "iaValidadeDiasCompra",
  "iaPacotes", "iaPesoPorRecurso", "iaExplicacoesGratisPorDia", "iaResumoSemanalSoAssinantes",
  "indicacao", "limiteUsuariosPorConta", "textosOferta"
) VALUES (
  gen_random_uuid()::text, 1, NOW(), 'sistema', 'Versão inicial do Ciclo 16',
  7, 3790, 1970, 38970,
  5, 14, 365,
  '[{"id":"pacote-25","nome":"25 perguntas","perguntas":25,"precoCentavos":2970,"ativo":true,"destaque":true}]'::jsonb,
  '{"CHAT":1,"ANALISE_CONTROLE":1,"EXPLICACAO":0,"RESUMO_SEMANAL":0}'::jsonb,
  20, true,
  '{"ativo":true,"diasRecompensa":7,"carenciaDias":7,"limiteRecompensasPorAno":52,"exigeMlConectado":true,"bonusIndicado":{"perguntasIa":5,"diasTesteExtra":0}}'::jsonb,
  NULL,
  '{"titulo":"Escolha o plano da sua loja","subtitulo":"7 dias grátis, sem cartão. Depois, escolha como quer continuar.","beneficios":["Estoque local e Full sincronizados com o Mercado Livre e o Bling","Reposição com o que comprar e quando, sobre a venda real","Lucro de verdade por venda, produto e logística","Equipe com papéis e permissões","Suporte por WhatsApp"],"seloAnual":"2 meses grátis","chamadaMensal":"Primeiro mês com desconto","chamadaTeste":"Comece grátis por 7 dias"}'::jsonb
)
ON CONFLICT ("versao") DO NOTHING;

UPDATE "subscriptions"
SET "precoContratadoCentavos" = CASE WHEN "plan" = 'ANNUAL' THEN 38970 ELSE 3790 END,
    "configuracaoVersao" = 1
WHERE "plan" IS NOT NULL AND "precoContratadoCentavos" IS NULL;
