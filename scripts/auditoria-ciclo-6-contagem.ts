import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function contar() {
  const totalProdutos = await prisma.produto.count();
  const produtosSemCusto = await prisma.produto.count({
    where: { OR: [{ custoMedio: null }, { custoMedio: 0 }] },
  });
  const produtosSemFornecedor = await prisma.produto.count({
    where: { fornecedores: { none: {} } },
  });
  const produtosSemAnuncioMLAtivo = await prisma.produto.count({
    where: { ProdutoMercadoLivre: { none: { mlStatus: "active" } } },
  });

  const contasBling = await prisma.blingAccount.findMany({
    select: { id: true, userId: true, isActive: true },
  });
  const contasML = await prisma.mercadoLivreAccount.findMany({
    select: { id: true, userId: true, isActive: true, nickname: true },
  });

  const armazens = await prisma.armazem.findMany({
    select: { id: true, nome: true, userId: true },
  });
  const armazensComNomeFull = armazens.filter((armazem) =>
    armazem.nome.toLowerCase().includes("full")
  );

  console.log("=== Produtos ===");
  console.log(`Total: ${totalProdutos}`);
  console.log(`Sem custo (null ou 0): ${produtosSemCusto}`);
  console.log(`Sem fornecedor vinculado: ${produtosSemFornecedor}`);
  console.log(
    `Sem anúncio ML ativo (Produto ainda não tem precoVenda — Fase 2): ${produtosSemAnuncioMLAtivo}`
  );

  console.log("\n=== Contas Bling ===");
  console.log(`Total: ${contasBling.length}`);
  console.log(`Ativas: ${contasBling.filter((c) => c.isActive).length}`);
  console.log(`Inativas: ${contasBling.filter((c) => !c.isActive).length}`);

  console.log("\n=== Contas Mercado Livre ===");
  console.log(`Total: ${contasML.length}`);
  console.log(`Ativas: ${contasML.filter((c) => c.isActive).length}`);
  console.log(`Inativas: ${contasML.filter((c) => !c.isActive).length}`);

  console.log("\n=== Armazéns ===");
  console.log(`Total: ${armazens.length}`);
  console.log(
    `Com "full" no nome (possível duplicidade com estoque Full do ML): ${armazensComNomeFull.length}`
  );
  for (const armazem of armazensComNomeFull) {
    console.log(`  - ${armazem.id}: "${armazem.nome}" (userId ${armazem.userId})`);
  }
}

contar()
  .catch((error) => {
    console.error("Erro ao contar dados:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
