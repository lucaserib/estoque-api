/*
  Warnings:

  - You are about to drop the `MercadoLivreAccount` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProdutoMercadoLivre` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MercadoLivreAccount" DROP CONSTRAINT "MercadoLivreAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoMercadoLivre" DROP CONSTRAINT "ProdutoMercadoLivre_mercadoLivreAccountId_fkey";

-- DropForeignKey
ALTER TABLE "ProdutoMercadoLivre" DROP CONSTRAINT "ProdutoMercadoLivre_produtoId_fkey";

-- DropTable
DROP TABLE "MercadoLivreAccount";

-- DropTable
DROP TABLE "ProdutoMercadoLivre";

-- CreateTable
CREATE TABLE "mercado_livre_accounts" (
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

    CONSTRAINT "mercado_livre_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos_mercado_livre" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "mlTitle" TEXT NOT NULL,
    "mlPrice" INTEGER NOT NULL,
    "mlAvailableQuantity" INTEGER NOT NULL,
    "mlSoldQuantity" INTEGER NOT NULL DEFAULT 0,
    "mlStatus" TEXT NOT NULL,
    "mlCondition" TEXT NOT NULL DEFAULT 'new',
    "mlListingType" TEXT NOT NULL DEFAULT 'gold_special',
    "mlPermalink" TEXT,
    "mlThumbnail" TEXT,
    "mlCategoryId" TEXT,
    "mlCategoryName" TEXT,
    "mlShippingMode" TEXT,
    "mlAcceptsMercadoPago" BOOLEAN NOT NULL DEFAULT true,
    "mlFreeShipping" BOOLEAN NOT NULL DEFAULT false,
    "mlLastUpdated" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "syncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_mercado_livre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercado_livre_sync_history" (
    "id" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "syncedItems" INTEGER NOT NULL DEFAULT 0,
    "newItems" INTEGER NOT NULL DEFAULT 0,
    "updatedItems" INTEGER NOT NULL DEFAULT 0,
    "errorItems" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "mercado_livre_sync_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercado_livre_webhooks" (
    "id" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "mlNotificationId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mercado_livre_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mercado_livre_accounts_mlUserId_key" ON "mercado_livre_accounts"("mlUserId");

-- CreateIndex
CREATE UNIQUE INDEX "mercado_livre_accounts_userId_mlUserId_key" ON "mercado_livre_accounts"("userId", "mlUserId");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_mercado_livre_produtoId_mercadoLivreAccountId_key" ON "produtos_mercado_livre"("produtoId", "mercadoLivreAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_mercado_livre_mlItemId_mercadoLivreAccountId_key" ON "produtos_mercado_livre"("mlItemId", "mercadoLivreAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "mercado_livre_webhooks_mlNotificationId_key" ON "mercado_livre_webhooks"("mlNotificationId");

-- AddForeignKey
ALTER TABLE "mercado_livre_accounts" ADD CONSTRAINT "mercado_livre_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos_mercado_livre" ADD CONSTRAINT "produtos_mercado_livre_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos_mercado_livre" ADD CONSTRAINT "produtos_mercado_livre_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "mercado_livre_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercado_livre_sync_history" ADD CONSTRAINT "mercado_livre_sync_history_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "mercado_livre_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercado_livre_webhooks" ADD CONSTRAINT "mercado_livre_webhooks_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "mercado_livre_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
