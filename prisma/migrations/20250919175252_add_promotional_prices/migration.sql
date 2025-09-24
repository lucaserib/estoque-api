-- AlterTable
ALTER TABLE "produtos_mercado_livre" ADD COLUMN     "mlBasePrice" INTEGER,
ADD COLUMN     "mlHasPromotion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mlOriginalPrice" INTEGER,
ADD COLUMN     "mlPromotionDiscount" INTEGER;
