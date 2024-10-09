-- AddForeignKey
ALTER TABLE "KitProduto" ADD CONSTRAINT "KitProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
