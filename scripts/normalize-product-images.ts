import { PrismaClient } from "@prisma/client";
import { normalizeImageUrl } from "../src/lib/imageUrl";

const prisma = new PrismaClient();

async function normalizeProdutoImages(apply: boolean) {
  const produtos = await prisma.produto.findMany({
    select: { id: true, imagemUrl: true, imagemThumbUrl: true },
  });

  const changes = produtos
    .map((produto) => {
      const normalizedUrl = normalizeImageUrl(produto.imagemUrl);
      const normalizedThumb = normalizeImageUrl(produto.imagemThumbUrl);
      const urlChanged = normalizedUrl !== produto.imagemUrl;
      const thumbChanged = normalizedThumb !== produto.imagemThumbUrl;

      if (!urlChanged && !thumbChanged) return null;

      return {
        id: produto.id,
        before: { imagemUrl: produto.imagemUrl, imagemThumbUrl: produto.imagemThumbUrl },
        after: { imagemUrl: normalizedUrl, imagemThumbUrl: normalizedThumb },
      };
    })
    .filter((change): change is NonNullable<typeof change> => change !== null);

  console.log(`Produto: ${changes.length} de ${produtos.length} registros seriam alterados`);
  for (const change of changes) {
    console.log(`  ${change.id}: ${change.before.imagemUrl} -> ${change.after.imagemUrl}`);
  }

  if (apply) {
    for (const change of changes) {
      await prisma.produto.update({
        where: { id: change.id },
        data: {
          imagemUrl: change.after.imagemUrl,
          imagemThumbUrl: change.after.imagemThumbUrl,
        },
      });
    }
    console.log(`Produto: ${changes.length} registros atualizados`);
  }

  return changes.length;
}

async function normalizeProdutoMercadoLivreImages(apply: boolean) {
  const registros = await prisma.produtoMercadoLivre.findMany({
    select: { id: true, mlThumbnail: true },
  });

  const changes = registros
    .map((registro) => {
      const normalized = normalizeImageUrl(registro.mlThumbnail);
      if (normalized === registro.mlThumbnail) return null;
      return { id: registro.id, before: registro.mlThumbnail, after: normalized };
    })
    .filter((change): change is NonNullable<typeof change> => change !== null);

  console.log(
    `ProdutoMercadoLivre: ${changes.length} de ${registros.length} registros seriam alterados`
  );
  for (const change of changes) {
    console.log(`  ${change.id}: ${change.before} -> ${change.after}`);
  }

  if (apply) {
    for (const change of changes) {
      await prisma.produtoMercadoLivre.update({
        where: { id: change.id },
        data: { mlThumbnail: change.after },
      });
    }
    console.log(`ProdutoMercadoLivre: ${changes.length} registros atualizados`);
  }

  return changes.length;
}

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(apply ? "Executando em modo de aplicação" : "Executando em modo de simulação (use --apply para gravar)");

  const produtoChanges = await normalizeProdutoImages(apply);
  const mlChanges = await normalizeProdutoMercadoLivreImages(apply);

  console.log(`Total: ${produtoChanges + mlChanges} registros ${apply ? "atualizados" : "seriam atualizados"}`);
}

main()
  .catch((error) => {
    console.error("Erro ao normalizar imagens:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
