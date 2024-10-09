-- AddForeignKey
ALTER TABLE "KitProduto" ADD CONSTRAINT "KitProduto_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
