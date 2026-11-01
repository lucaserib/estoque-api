-- Ciclo 13: cobranças por venda da fatura do ML (CVV*, CFON*, CFF*) foram gravadas
-- como NAO_MAPEADO e somadas de novo na DRE. Reclassifica e marca como cobertas
-- pelo pedido (só conciliação). Idempotente: só toca linhas ainda não mapeadas.
UPDATE "cobrancas_canal"
SET "tipoNormalizado" = CASE
      WHEN split_part("tipoExterno", ' ', 1) ~ '^(CVVPRC|CVVFN|CFON)' THEN 'TARIFA_MERCADO_PAGO'
      WHEN split_part("tipoExterno", ' ', 1) ~ '^CVV' THEN 'TARIFA_VENDA'
      ELSE 'FRETE'
    END,
    "coberturaPedido" = true,
    "updatedAt" = NOW()
WHERE "tipoNormalizado" = 'NAO_MAPEADO'
  AND split_part("tipoExterno", ' ', 1) ~ '^(CVV|CFON|CFF)';
