UPDATE "Armazem" SET "tipo" = 'FULL_ML'
WHERE "tipo" != 'FULL_ML'
  AND (
    "nome" = 'Full (Mercado Livre)'
    OR "id" IN (
      SELECT DISTINCT "armazemId" FROM "estoque_movimentacoes" WHERE "origem" = 'SINCRONIZACAO_FULL_ML'
    )
  );
