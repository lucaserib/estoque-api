ALTER TABLE "Produto" ADD COLUMN     "imagemUrl" TEXT,
ADD COLUMN     "imagemThumbUrl" TEXT,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "marca" TEXT,
ADD COLUMN     "categoria" TEXT,
ADD COLUMN     "pesoGramas" INTEGER,
ADD COLUMN     "alturaCm" INTEGER,
ADD COLUMN     "larguraCm" INTEGER,
ADD COLUMN     "comprimentoCm" INTEGER,
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ProdutoFornecedor" ADD COLUMN     "prazoEntregaDias" INTEGER,
ADD COLUMN     "precoUnitario" INTEGER,
ADD COLUMN     "quantidadeMinima" INTEGER,
ADD COLUMN     "principal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codigoNoFornecedor" TEXT;
