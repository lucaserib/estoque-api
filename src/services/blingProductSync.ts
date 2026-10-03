import { prisma } from "@/lib/prisma";
import { Armazem } from "@prisma/client";
import { BlingService, BlingProduct } from "@/services/blingService";
import { resolverCustoProduto } from "@/lib/custo";
import { stringToBigIntEAN } from "@/utils/ean";
import { rehostTemporaryImage } from "@/lib/blingImageHost";
import { normalizeSku } from "@/lib/sku";

export interface FornecedorResolvido {
  fornecedorId: string | null;
  precoCusto: number | null;
  codigo: string | undefined;
}

export async function resolverFornecedorPrincipalBling(
  accountId: string,
  blingProdutoId: number,
  userId: string
): Promise<FornecedorResolvido> {
  const fornecedores = await BlingService.getProductSuppliers(
    accountId,
    blingProdutoId
  );
  const padrao = fornecedores.find((f) => f.padrao) ?? fornecedores[0];
  if (!padrao) {
    return { fornecedorId: null, precoCusto: null, codigo: undefined };
  }

  const contato = await BlingService.getContact(
    accountId,
    padrao.fornecedor.id
  );

  const fornecedor = await prisma.fornecedor.upsert({
    where: {
      userId_blingContatoId: {
        userId,
        blingContatoId: String(contato.id),
      },
    },
    update: { nome: contato.nome, cnpj: contato.numeroDocumento },
    create: {
      userId,
      nome: contato.nome,
      cnpj: contato.numeroDocumento,
      blingContatoId: String(contato.id),
    },
  });

  return {
    fornecedorId: fornecedor.id,
    precoCusto: padrao.precoCompra ?? padrao.precoCusto ?? null,
    codigo: padrao.codigo,
  };
}

export async function vincularFornecedorProdutoBling(
  produtoId: string,
  fornecedorId: string,
  precoCusto: number,
  codigo: string | undefined
): Promise<void> {
  const precoCentavos = Math.round(precoCusto * 100);

  const vinculoExistente = await prisma.produtoFornecedor.findFirst({
    where: { produtoId, fornecedorId },
  });

  if (vinculoExistente) {
    await prisma.produtoFornecedor.update({
      where: { id: vinculoExistente.id },
      data: {
        preco: precoCentavos,
        precoUnitario: precoCentavos,
        codigoNoFornecedor: codigo,
        principal: true,
      },
    });
  } else {
    await prisma.produtoFornecedor.create({
      data: {
        produtoId,
        fornecedorId,
        preco: precoCentavos,
        precoUnitario: precoCentavos,
        multiplicador: 1,
        codigoNF: codigo ?? null,
        codigoNoFornecedor: codigo,
        principal: true,
      },
    });
  }

  await prisma.produtoFornecedor.updateMany({
    where: { produtoId, fornecedorId: { not: fornecedorId } },
    data: { principal: false },
  });
}

export interface AplicarDetalheResultado {
  produtoId: string;
  criado: boolean;
}

export async function aplicarDetalheProdutoBling(params: {
  userId: string;
  sku: string;
  blingIdStr: string;
  detalhe: BlingProduct;
  existenteId: string | null;
  precoCustoFornecedorPadraoBling: number | null;
}): Promise<AplicarDetalheResultado> {
  const { userId, sku, blingIdStr, detalhe, existenteId, precoCustoFornecedorPadraoBling } =
    params;

  const ean = stringToBigIntEAN(BlingService.extractEAN(detalhe) ?? undefined);
  const isKit = BlingService.isKit(detalhe);

  const resultadoCusto = isKit
    ? { custoMedio: null, custoOrigem: null, preservado: false }
    : await resolverCustoProduto({
        produtoId: existenteId ?? undefined,
        sku,
        userId,
        precoCustoFornecedorPadraoBling,
        precoCustoProdutoBling: detalhe.precoCusto,
      });

  const imagemInfo = BlingService.extractImageInfo(detalhe);
  let imagemUrl = imagemInfo?.url ?? null;
  if (imagemInfo?.temporaria) {
    imagemUrl = (await rehostTemporaryImage(imagemInfo.url, sku)) ?? imagemInfo.url;
  }

  const dadosComuns = {
    nome: detalhe.nome,
    ean,
    marca: detalhe.marca ?? null,
    pesoGramas: detalhe.pesoBruto ? Math.round(detalhe.pesoBruto * 1000) : null,
    larguraCm: detalhe.dimensoes?.largura ?? null,
    alturaCm: detalhe.dimensoes?.altura ?? null,
    comprimentoCm: detalhe.dimensoes?.profundidade ?? null,
    precoVenda: detalhe.preco ? Math.round(detalhe.preco * 100) : null,
    precoOrigem: detalhe.preco ? ("BLING" as const) : null,
    blingId: blingIdStr,
    isKit,
    ativo: BlingService.isProductActive(detalhe),
    ...(imagemUrl ? { imagemUrl } : {}),
    ...(resultadoCusto.preservado
      ? {}
      : {
          custoMedio: resultadoCusto.custoMedio,
          custoOrigem: resultadoCusto.custoOrigem,
          custoAtualizadoEm: resultadoCusto.custoMedio !== null ? new Date() : null,
        }),
  };

  const produto = existenteId
    ? await prisma.produto.update({ where: { id: existenteId }, data: dadosComuns })
    : await prisma.produto.create({ data: { ...dadosComuns, sku, userId } });

  return { produtoId: produto.id, criado: !existenteId };
}

export async function sincronizarComponentesKitBling(
  kitProdutoId: string,
  detalhe: BlingProduct,
  resolverComponenteLocal: (blingIdComponente: string) => Promise<string | null>
): Promise<void> {
  if (!detalhe.estrutura?.componentes) return;

  for (const componenteBling of detalhe.estrutura.componentes) {
    const componenteLocalId = await resolverComponenteLocal(
      String(componenteBling.produto.id)
    );
    if (!componenteLocalId) continue;

    const vinculoExistente = await prisma.componente.findFirst({
      where: { kitId: kitProdutoId, produtoId: componenteLocalId },
    });

    if (vinculoExistente) {
      await prisma.componente.update({
        where: { id: vinculoExistente.id },
        data: { quantidade: componenteBling.quantidade },
      });
    } else {
      await prisma.componente.create({
        data: {
          kitId: kitProdutoId,
          produtoId: componenteLocalId,
          quantidade: componenteBling.quantidade,
        },
      });
    }
  }
}

export async function sincronizarProdutoUnico(
  accountId: string,
  userId: string,
  blingProdutoId: number
): Promise<AplicarDetalheResultado> {
  const blingIdStr = String(blingProdutoId);
  const detalhe = await BlingService.getProductById(accountId, blingProdutoId);
  const skuBruto = BlingService.extractSKU(detalhe);
  if (!skuBruto) {
    throw new Error(`Produto Bling ${blingProdutoId} sem SKU, ignorado`);
  }
  const sku = normalizeSku(skuBruto);

  const existente = await prisma.produto.findFirst({
    where: { userId, OR: [{ blingId: blingIdStr }, { sku }] },
    select: { id: true },
  });

  const { fornecedorId, precoCusto: precoCustoFornecedor, codigo } =
    await resolverFornecedorPrincipalBling(accountId, blingProdutoId, userId);

  const resultado = await aplicarDetalheProdutoBling({
    userId,
    sku,
    blingIdStr,
    detalhe,
    existenteId: existente?.id ?? null,
    precoCustoFornecedorPadraoBling: precoCustoFornecedor,
  });

  if (fornecedorId && precoCustoFornecedor) {
    await vincularFornecedorProdutoBling(
      resultado.produtoId,
      fornecedorId,
      precoCustoFornecedor,
      codigo
    );
  }

  if (BlingService.isKit(detalhe)) {
    await sincronizarComponentesKitBling(
      resultado.produtoId,
      detalhe,
      async (blingIdComponente) => {
        const componente = await prisma.produto.findUnique({
          where: { userId_blingId: { userId, blingId: blingIdComponente } },
          select: { id: true },
        });
        return componente?.id ?? null;
      }
    );
  }

  return resultado;
}

export async function sincronizarEstoqueUnico(
  accountId: string,
  userId: string,
  blingProdutoId: number
): Promise<void> {
  const produtoLocal = await prisma.produto.findFirst({
    where: { userId, blingId: String(blingProdutoId) },
    select: { id: true, estoques: { select: { armazemId: true, quantidade: true } } },
  });
  if (!produtoLocal) return;

  const armazemPorDeposito = await garantirArmazensParaDepositos(accountId, userId);
  const { data: stockItems } = await BlingService.getProductsStock(accountId, [
    blingProdutoId,
  ]);
  const stock = stockItems[0];
  if (!stock) return;

  await aplicarEstoqueProdutoBling({
    userId,
    produtoLocalId: produtoLocal.id,
    depositosSaldo: stock.depositos,
    armazemPorDeposito,
    estoquesAtuais: produtoLocal.estoques,
  });
}

export async function sincronizarFornecedorUnico(
  accountId: string,
  userId: string,
  blingProdutoId: number
): Promise<void> {
  const produtoLocal = await prisma.produto.findFirst({
    where: { userId, blingId: String(blingProdutoId) },
    select: { id: true },
  });
  if (!produtoLocal) return;

  const { fornecedorId, precoCusto, codigo } = await resolverFornecedorPrincipalBling(
    accountId,
    blingProdutoId,
    userId
  );
  if (fornecedorId && precoCusto) {
    await vincularFornecedorProdutoBling(produtoLocal.id, fornecedorId, precoCusto, codigo);
  }
}

export async function inativarProdutoPorBlingId(
  userId: string,
  blingIdStr: string
): Promise<void> {
  await prisma.produto.updateMany({
    where: { userId, blingId: blingIdStr },
    data: { ativo: false },
  });
}

export async function garantirArmazensParaDepositos(
  accountId: string,
  userId: string
): Promise<Map<string, Armazem>> {
  const deposits = await BlingService.getDeposits(accountId);
  const armazensExistentes = await prisma.armazem.findMany({ where: { userId } });
  const armazemPorDeposito = new Map(
    armazensExistentes
      .filter((a) => a.blingDepositoId)
      .map((a) => [a.blingDepositoId as string, a])
  );

  for (const deposit of deposits) {
    const depositoId = String(deposit.id);
    if (!armazemPorDeposito.has(depositoId)) {
      const novoArmazem = await prisma.armazem.create({
        data: {
          userId,
          nome: deposit.descricao,
          blingDepositoId: depositoId,
          tipo: "LOCAL",
        },
      });
      armazemPorDeposito.set(depositoId, novoArmazem);
    }
  }

  return armazemPorDeposito;
}

export interface AplicarEstoqueDepositoResultado {
  armazemId: string;
  armazemNome: string;
  quantidadeAnterior: number;
  quantidadeNova: number;
  mudou: boolean;
}

export async function aplicarEstoqueProdutoBling(params: {
  userId: string;
  produtoLocalId: string;
  depositosSaldo: Array<{ id: number; saldoFisico: number }>;
  armazemPorDeposito: Map<string, Armazem>;
  estoquesAtuais: Array<{ armazemId: string; quantidade: number }>;
}): Promise<AplicarEstoqueDepositoResultado[]> {
  const { userId, produtoLocalId, depositosSaldo, armazemPorDeposito, estoquesAtuais } =
    params;

  const resultados: AplicarEstoqueDepositoResultado[] = [];

  for (const depositoSaldo of depositosSaldo) {
    const armazem = armazemPorDeposito.get(String(depositoSaldo.id));
    if (!armazem) continue;

    const quantidadeAnterior =
      estoquesAtuais.find((e) => e.armazemId === armazem.id)?.quantidade ?? 0;
    const quantidadeNova = Math.round(depositoSaldo.saldoFisico);

    if (quantidadeAnterior === quantidadeNova) {
      resultados.push({
        armazemId: armazem.id,
        armazemNome: armazem.nome,
        quantidadeAnterior,
        quantidadeNova,
        mudou: false,
      });
      continue;
    }

    await prisma.$transaction([
      prisma.estoque.upsert({
        where: {
          produtoId_armazemId: { produtoId: produtoLocalId, armazemId: armazem.id },
        },
        update: { quantidade: quantidadeNova },
        create: { produtoId: produtoLocalId, armazemId: armazem.id, quantidade: quantidadeNova },
      }),
      prisma.estoqueMovimentacao.create({
        data: {
          userId,
          produtoId: produtoLocalId,
          armazemId: armazem.id,
          quantidadeAnterior,
          quantidadeNova,
          origem: "SINCRONIZACAO_BLING",
        },
      }),
    ]);

    resultados.push({
      armazemId: armazem.id,
      armazemNome: armazem.nome,
      quantidadeAnterior,
      quantidadeNova,
      mudou: true,
    });
  }

  return resultados;
}
