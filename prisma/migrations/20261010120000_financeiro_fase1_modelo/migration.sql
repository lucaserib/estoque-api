-- Ciclo 7 Fase 1: modelo de dados do módulo Financeiro (aditiva)
-- CREATE TABLE/INDEX usam IF NOT EXISTS por segurança (lição do Ciclo 6
-- Fase 9: reaplicar este arquivo do zero nunca deve falhar por objeto já
-- existente). Nomes de enum conferidos por grep contra todas as migrações
-- anteriores antes de escrever este arquivo — nenhuma colisão.

-- CreateEnum
CREATE TYPE "CanalVenda" AS ENUM ('MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU', 'LOJA_PROPRIA', 'ERP', 'OUTRO');
CREATE TYPE "StatusVendaCanal" AS ENUM ('PAGA', 'CANCELADA', 'DEVOLVIDA', 'DEVOLVIDA_PARCIAL', 'EM_MEDIACAO');
CREATE TYPE "GrupoDre" AS ENUM ('RECEITA_BRUTA', 'DEDUCAO_RECEITA', 'IMPOSTO_VENDA', 'CUSTO_VARIAVEL', 'CMV', 'DESPESA_OPERACIONAL', 'RESULTADO_FINANCEIRO', 'IMPOSTO_LUCRO', 'NAO_OPERACIONAL');
CREATE TYPE "TipoLancamento" AS ENUM ('RECEITA', 'DESPESA', 'TRANSFERENCIA');
CREATE TYPE "StatusLancamento" AS ENUM ('PREVISTO', 'PAGO', 'CANCELADO');
CREATE TYPE "OrigemLancamento" AS ENUM ('MANUAL', 'RECORRENCIA', 'PARCELAMENTO', 'CARTAO', 'PEDIDO_COMPRA', 'CANAL_COBRANCA', 'CONCILIACAO', 'ERP');
CREATE TYPE "Confianca" AS ENUM ('ESTIMADO', 'CONFIRMADO');
CREATE TYPE "TipoContaFinanceira" AS ENUM ('BANCO', 'CARTAO_CREDITO', 'CARTEIRA_MARKETPLACE', 'CAIXA');
CREATE TYPE "FrequenciaRecorrencia" AS ENUM ('SEMANAL', 'MENSAL', 'ANUAL');
CREATE TYPE "RegimeTributario" AS ENUM ('SIMPLES', 'PRESUMIDO', 'REAL');
CREATE TYPE "CancelamentoCompetencia" AS ENUM ('VENDA', 'CANCELAMENTO');
CREATE TYPE "RateioCustoFixo" AS ENUM ('FATURAMENTO', 'UNIDADE', 'NENHUM');

-- AlterTable: ConfiguracaoGeral ganha as configs do Financeiro
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "regimeTributario" "RegimeTributario" NOT NULL DEFAULT 'SIMPLES';
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "cancelamentoNaCompetencia" "CancelamentoCompetencia" NOT NULL DEFAULT 'VENDA';
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "rateioCustoFixo" "RateioCustoFixo" NOT NULL DEFAULT 'FATURAMENTO';
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "custoEnvioFlex" INTEGER;
ALTER TABLE "configuracoes_gerais" ADD COLUMN IF NOT EXISTS "usarImpostoEstimado" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "vendas_canal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canal" "CanalVenda" NOT NULL,
    "contaCanalId" TEXT NOT NULL,
    "pedidoExternoId" TEXT NOT NULL,
    "pacoteExternoId" TEXT,
    "dataVenda" TIMESTAMP(3) NOT NULL,
    "dataCancelamento" TIMESTAMP(3),
    "dataLiberacao" TIMESTAMP(3),
    "status" "StatusVendaCanal" NOT NULL,
    "logistica" TEXT,
    "envioExternoId" TEXT,
    "faturamentoBruto" INTEGER NOT NULL,
    "descontoVendedor" INTEGER NOT NULL,
    "tarifaVenda" INTEGER NOT NULL,
    "freteVendedor" INTEGER,
    "freteComprador" INTEGER NOT NULL,
    "impostoEstimado" INTEGER NOT NULL,
    "adsAtribuido" INTEGER NOT NULL,
    "cmv" INTEGER,
    "outrosCustos" INTEGER NOT NULL DEFAULT 0,
    "margemContribuicao" INTEGER,
    "valorLiquidoReceber" INTEGER,
    "completo" BOOLEAN NOT NULL DEFAULT true,
    "faltando" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "freteConfianca" "Confianca" NOT NULL DEFAULT 'ESTIMADO',
    "atualizadoNoCanalEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendas_canal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vendas_canal_itens" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT,
    "sku" TEXT,
    "anuncioExternoId" TEXT NOT NULL,
    "variacaoExternaId" TEXT,
    "titulo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" INTEGER NOT NULL,
    "precoCheio" INTEGER,
    "tarifaVenda" INTEGER NOT NULL,
    "freteRateado" INTEGER,
    "descontoRateado" INTEGER NOT NULL DEFAULT 0,
    "impostoRateado" INTEGER NOT NULL DEFAULT 0,
    "adsRateado" INTEGER NOT NULL DEFAULT 0,
    "custoUnitario" INTEGER,
    "margemContribuicao" INTEGER,

    CONSTRAINT "vendas_canal_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "categorias_financeiras" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupoDre" "GrupoDre" NOT NULL,
    "paiId" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contas_financeiras" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoContaFinanceira" NOT NULL,
    "saldoInicial" INTEGER NOT NULL DEFAULT 0,
    "dataSaldoInicial" TIMESTAMP(3) NOT NULL,
    "diaFechamento" INTEGER,
    "diaVencimento" INTEGER,
    "limite" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "lancamentos_financeiros" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "contaFinanceiraId" TEXT,
    "competencia" TIMESTAMP(3) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pagamento" TIMESTAMP(3),
    "status" "StatusLancamento" NOT NULL DEFAULT 'PREVISTO',
    "origem" "OrigemLancamento" NOT NULL DEFAULT 'MANUAL',
    "confianca" "Confianca" NOT NULL DEFAULT 'CONFIRMADO',
    "fornecedorId" TEXT,
    "produtoId" TEXT,
    "pedidoCompraId" INTEGER,
    "vendaId" TEXT,
    "recorrenciaId" TEXT,
    "faturaCartaoId" TEXT,
    "grupoParcelamentoId" TEXT,
    "parcelaNumero" INTEGER,
    "parcelaTotal" INTEGER,
    "chaveExterna" TEXT,
    "anexoUrl" TEXT,
    "observacao" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "recorrencias_financeiras" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "contaFinanceiraId" TEXT,
    "fornecedorId" TEXT,
    "frequencia" "FrequenciaRecorrencia" NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "geradoAte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recorrencias_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "faturas_cartao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contaFinanceiraId" TEXT NOT NULL,
    "mesReferencia" TEXT NOT NULL,
    "fechamento" TIMESTAMP(3) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusLancamento" NOT NULL DEFAULT 'PREVISTO',
    "lancamentoPagamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturas_cartao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "gastos_ads_canal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canal" "CanalVenda" NOT NULL,
    "contaCanalId" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "campanhaExternaId" TEXT,
    "anuncioExternoId" TEXT,
    "produtoId" TEXT,
    "custo" INTEGER NOT NULL,
    "cliques" INTEGER,
    "impressoes" INTEGER,
    "vendasAtribuidas" INTEGER,
    "receitaAtribuida" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_ads_canal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cobrancas_canal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canal" "CanalVenda" NOT NULL,
    "contaCanalId" TEXT NOT NULL,
    "mesReferencia" TEXT NOT NULL,
    "detalheExternoId" TEXT NOT NULL,
    "tipoExterno" TEXT NOT NULL,
    "tipoNormalizado" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "pedidoExternoId" TEXT,
    "anuncioExternoId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "coberturaPedido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobrancas_canal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "resumos_financeiros_diarios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "canal" "CanalVenda" NOT NULL,
    "pedidos" INTEGER NOT NULL DEFAULT 0,
    "unidades" INTEGER NOT NULL DEFAULT 0,
    "faturamentoBruto" INTEGER NOT NULL DEFAULT 0,
    "cancelamentos" INTEGER NOT NULL DEFAULT 0,
    "descontos" INTEGER NOT NULL DEFAULT 0,
    "impostos" INTEGER NOT NULL DEFAULT 0,
    "tarifas" INTEGER NOT NULL DEFAULT 0,
    "frete" INTEGER NOT NULL DEFAULT 0,
    "ads" INTEGER NOT NULL DEFAULT 0,
    "cmv" INTEGER NOT NULL DEFAULT 0,
    "margemContribuicao" INTEGER NOT NULL DEFAULT 0,
    "vendasIncompletas" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumos_financeiros_diarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sincronizacoes_financeiras" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canal" "CanalVenda" NOT NULL,
    "tipo" TEXT NOT NULL,
    "cursor" JSONB,
    "status" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "processados" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,

    CONSTRAINT "sincronizacoes_financeiras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vendas_canal_userId_canal_pedidoExternoId_key" ON "vendas_canal"("userId", "canal", "pedidoExternoId");
CREATE INDEX IF NOT EXISTS "vendas_canal_userId_dataVenda_idx" ON "vendas_canal"("userId", "dataVenda");
CREATE INDEX IF NOT EXISTS "vendas_canal_userId_dataLiberacao_idx" ON "vendas_canal"("userId", "dataLiberacao");

CREATE INDEX IF NOT EXISTS "vendas_canal_itens_produtoId_idx" ON "vendas_canal_itens"("produtoId");
CREATE INDEX IF NOT EXISTS "vendas_canal_itens_vendaId_idx" ON "vendas_canal_itens"("vendaId");

CREATE UNIQUE INDEX IF NOT EXISTS "categorias_financeiras_userId_paiId_nome_key" ON "categorias_financeiras"("userId", "paiId", "nome");

CREATE INDEX IF NOT EXISTS "contas_financeiras_userId_idx" ON "contas_financeiras"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "lancamentos_financeiros_userId_chaveExterna_key" ON "lancamentos_financeiros"("userId", "chaveExterna");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_userId_competencia_idx" ON "lancamentos_financeiros"("userId", "competencia");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_userId_vencimento_status_idx" ON "lancamentos_financeiros"("userId", "vencimento", "status");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_categoriaId_idx" ON "lancamentos_financeiros"("categoriaId");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_contaFinanceiraId_idx" ON "lancamentos_financeiros"("contaFinanceiraId");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_grupoParcelamentoId_idx" ON "lancamentos_financeiros"("grupoParcelamentoId");

CREATE INDEX IF NOT EXISTS "recorrencias_financeiras_userId_idx" ON "recorrencias_financeiras"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "faturas_cartao_contaFinanceiraId_mesReferencia_key" ON "faturas_cartao"("contaFinanceiraId", "mesReferencia");

CREATE UNIQUE INDEX IF NOT EXISTS "gastos_ads_canal_userId_canal_dia_campanhaExternaId_anunci_key" ON "gastos_ads_canal"("userId", "canal", "dia", "campanhaExternaId", "anuncioExternoId");
CREATE INDEX IF NOT EXISTS "gastos_ads_canal_userId_dia_idx" ON "gastos_ads_canal"("userId", "dia");

CREATE UNIQUE INDEX IF NOT EXISTS "cobrancas_canal_userId_canal_detalheExternoId_key" ON "cobrancas_canal"("userId", "canal", "detalheExternoId");
CREATE INDEX IF NOT EXISTS "cobrancas_canal_userId_mesReferencia_idx" ON "cobrancas_canal"("userId", "mesReferencia");

CREATE UNIQUE INDEX IF NOT EXISTS "resumos_financeiros_diarios_userId_dia_canal_key" ON "resumos_financeiros_diarios"("userId", "dia", "canal");

CREATE INDEX IF NOT EXISTS "sincronizacoes_financeiras_userId_canal_tipo_idx" ON "sincronizacoes_financeiras"("userId", "canal", "tipo");

-- AddForeignKey
ALTER TABLE "vendas_canal" DROP CONSTRAINT IF EXISTS "vendas_canal_userId_fkey";
ALTER TABLE "vendas_canal" ADD CONSTRAINT "vendas_canal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendas_canal_itens" DROP CONSTRAINT IF EXISTS "vendas_canal_itens_vendaId_fkey";
ALTER TABLE "vendas_canal_itens" DROP CONSTRAINT IF EXISTS "vendas_canal_itens_produtoId_fkey";
ALTER TABLE "vendas_canal_itens" ADD CONSTRAINT "vendas_canal_itens_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas_canal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendas_canal_itens" ADD CONSTRAINT "vendas_canal_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "categorias_financeiras" DROP CONSTRAINT IF EXISTS "categorias_financeiras_userId_fkey";
ALTER TABLE "categorias_financeiras" DROP CONSTRAINT IF EXISTS "categorias_financeiras_paiId_fkey";
ALTER TABLE "categorias_financeiras" ADD CONSTRAINT "categorias_financeiras_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorias_financeiras" ADD CONSTRAINT "categorias_financeiras_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "categorias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contas_financeiras" DROP CONSTRAINT IF EXISTS "contas_financeiras_userId_fkey";
ALTER TABLE "contas_financeiras" ADD CONSTRAINT "contas_financeiras_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_userId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_categoriaId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_contaFinanceiraId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_fornecedorId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_produtoId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_pedidoCompraId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_vendaId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_recorrenciaId_fkey";
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT IF EXISTS "lancamentos_financeiros_faturaCartaoId_fkey";
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas_canal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "recorrencias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_faturaCartaoId_fkey" FOREIGN KEY ("faturaCartaoId") REFERENCES "faturas_cartao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recorrencias_financeiras" DROP CONSTRAINT IF EXISTS "recorrencias_financeiras_userId_fkey";
ALTER TABLE "recorrencias_financeiras" DROP CONSTRAINT IF EXISTS "recorrencias_financeiras_categoriaId_fkey";
ALTER TABLE "recorrencias_financeiras" DROP CONSTRAINT IF EXISTS "recorrencias_financeiras_contaFinanceiraId_fkey";
ALTER TABLE "recorrencias_financeiras" DROP CONSTRAINT IF EXISTS "recorrencias_financeiras_fornecedorId_fkey";
ALTER TABLE "recorrencias_financeiras" ADD CONSTRAINT "recorrencias_financeiras_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recorrencias_financeiras" ADD CONSTRAINT "recorrencias_financeiras_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financeiras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recorrencias_financeiras" ADD CONSTRAINT "recorrencias_financeiras_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recorrencias_financeiras" ADD CONSTRAINT "recorrencias_financeiras_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "faturas_cartao" DROP CONSTRAINT IF EXISTS "faturas_cartao_userId_fkey";
ALTER TABLE "faturas_cartao" DROP CONSTRAINT IF EXISTS "faturas_cartao_contaFinanceiraId_fkey";
ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "faturas_cartao" ADD CONSTRAINT "faturas_cartao_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "contas_financeiras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gastos_ads_canal" DROP CONSTRAINT IF EXISTS "gastos_ads_canal_userId_fkey";
ALTER TABLE "gastos_ads_canal" DROP CONSTRAINT IF EXISTS "gastos_ads_canal_produtoId_fkey";
ALTER TABLE "gastos_ads_canal" ADD CONSTRAINT "gastos_ads_canal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gastos_ads_canal" ADD CONSTRAINT "gastos_ads_canal_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cobrancas_canal" DROP CONSTRAINT IF EXISTS "cobrancas_canal_userId_fkey";
ALTER TABLE "cobrancas_canal" ADD CONSTRAINT "cobrancas_canal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "resumos_financeiros_diarios" DROP CONSTRAINT IF EXISTS "resumos_financeiros_diarios_userId_fkey";
ALTER TABLE "resumos_financeiros_diarios" ADD CONSTRAINT "resumos_financeiros_diarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sincronizacoes_financeiras" DROP CONSTRAINT IF EXISTS "sincronizacoes_financeiras_userId_fkey";
ALTER TABLE "sincronizacoes_financeiras" ADD CONSTRAINT "sincronizacoes_financeiras_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
