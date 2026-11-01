-- DropIndex
DROP INDEX IF EXISTS "produtos_mercado_livre_produtoId_mercadoLivreAccountId_key";

-- AlterTable
ALTER TABLE "produtos_mercado_livre" ADD COLUMN IF NOT EXISTS "mlSold90Days" INTEGER;
ALTER TABLE "produtos_mercado_livre" ALTER COLUMN "produtoId" DROP NOT NULL;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'gastos_ads_canal_userId_canal_dia_campanhaExternaId_anunci_key')
       AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'gastos_ads_canal_userId_canal_dia_campanhaExternaId_anuncio_key') THEN
        ALTER INDEX "gastos_ads_canal_userId_canal_dia_campanhaExternaId_anunci_key" RENAME TO "gastos_ads_canal_userId_canal_dia_campanhaExternaId_anuncio_key";
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sincronizacoes_financeiras_erros_userId_canal_pedidoExtern_key')
       AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'sincronizacoes_financeiras_erros_userId_canal_pedidoExterno_key') THEN
        ALTER INDEX "sincronizacoes_financeiras_erros_userId_canal_pedidoExtern_key" RENAME TO "sincronizacoes_financeiras_erros_userId_canal_pedidoExterno_key";
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tarefas_sincronizacao_financeira_userId_contaCanalId_statu_idx')
       AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tarefas_sincronizacao_financeira_userId_contaCanalId_status_idx') THEN
        ALTER INDEX "tarefas_sincronizacao_financeira_userId_contaCanalId_statu_idx" RENAME TO "tarefas_sincronizacao_financeira_userId_contaCanalId_status_idx";
    END IF;
END $$;
