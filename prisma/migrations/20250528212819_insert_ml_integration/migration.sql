-- CreateTable
CREATE TABLE "MercadoLivreAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mlUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "nickname" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MercadoLivreAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoMercadoLivre" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "mlTitle" TEXT NOT NULL,
    "mlPrice" INTEGER NOT NULL,
    "mlAvailableQuantity" INTEGER NOT NULL,
    "mlStatus" TEXT NOT NULL,
    "mlPermalink" TEXT,
    "mlThumbnail" TEXT,
    "mlCategoryId" TEXT,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoMercadoLivre_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MercadoLivreAccount_mlUserId_key" ON "MercadoLivreAccount"("mlUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoLivreAccount_userId_mlUserId_key" ON "MercadoLivreAccount"("userId", "mlUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoMercadoLivre_produtoId_mercadoLivreAccountId_key" ON "ProdutoMercadoLivre"("produtoId", "mercadoLivreAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoMercadoLivre_mlItemId_mercadoLivreAccountId_key" ON "ProdutoMercadoLivre"("mlItemId", "mercadoLivreAccountId");

-- AddForeignKey
ALTER TABLE "MercadoLivreAccount" ADD CONSTRAINT "MercadoLivreAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoMercadoLivre" ADD CONSTRAINT "ProdutoMercadoLivre_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoMercadoLivre" ADD CONSTRAINT "ProdutoMercadoLivre_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
