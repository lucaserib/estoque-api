-- Ciclo 7 Fase 4: flag para a leitura opcional do relatório de dinheiro
-- liberado do Mercado Pago (desligada por padrão).
ALTER TABLE "configuracoes_gerais"
  ADD COLUMN IF NOT EXISTS "usarRelatorioLiberacaoMercadoPago" BOOLEAN NOT NULL DEFAULT false;
