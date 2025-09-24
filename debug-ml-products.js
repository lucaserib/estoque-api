const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugProducts() {
  try {
    console.log('🔍 Buscando produtos ML para debug...');
    
    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: '72e832fa-1d0f-47de-8960-58fa858a5d9b',
      },
      take: 5,
      orderBy: { lastSyncAt: 'desc' },
    });

    console.log(`📦 ${produtos.length} produtos encontrados\n`);

    produtos.forEach((produto, index) => {
      console.log(`--- PRODUTO ${index + 1} ---`);
      console.log(`ML ID: ${produto.mlItemId}`);
      console.log(`Título: ${produto.mlTitle?.substring(0, 60)}...`);
      console.log(`Preço bruto: ${produto.mlPrice} (tipo: ${typeof produto.mlPrice})`);
      console.log(`Preço original: ${produto.mlOriginalPrice} (tipo: ${typeof produto.mlOriginalPrice})`);
      console.log(`Tem promoção: ${produto.mlHasPromotion}`);
      console.log(`Desconto: ${produto.mlPromotionDiscount}%`);
      console.log(`Quantidade disponível: ${produto.mlAvailableQuantity}`);
      console.log(`Quantidade vendida: ${produto.mlSoldQuantity}`);
      console.log(`Status: ${produto.mlStatus}`);
      console.log(`Última sync: ${produto.lastSyncAt}`);
      
      // Formatação manual para debug
      if (produto.mlPrice) {
        console.log(`💰 Preço formatado (÷100): R$ ${(produto.mlPrice / 100).toFixed(2)}`);
        console.log(`💰 Preço formatado (÷1000): R$ ${(produto.mlPrice / 1000).toFixed(2)}`);
      }
      
      if (produto.mlOriginalPrice) {
        console.log(`💸 Original formatado (÷100): R$ ${(produto.mlOriginalPrice / 100).toFixed(2)}`);
      }
      
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugProducts();
