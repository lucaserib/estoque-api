UPDATE "Produto" SET "custoMedio" = NULL WHERE "custoMedio" = 0;

ALTER TABLE "Produto" ALTER COLUMN "custoMedio" DROP DEFAULT;
