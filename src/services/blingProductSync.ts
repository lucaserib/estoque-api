import { prisma } from "@/lib/prisma";
import { Armazem } from "@prisma/client";
import { BlingService, BlingProduct } from "@/services/blingService";
import { resolverCustoProduto } from "@/lib/custo";
import { stringToBigIntEAN } from "@/utils/ean";
import { rehostTemporaryImage } from "@/lib/blingImageHost";
import { normalizeSku } from "@/lib/sku";

/** Produto que não entra no estoque por um motivo de cadastro (não é falha da sincronização). */
export class BlingProdutoIgnorado extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlingProdutoIgnorado";
  }
}

export interface FornecedorResolvido {
  fornecedorId: string | null;
  precoCusto: number | null;
  codigo: string | undefined;
}

/**
 * Contato do fornecedor muda pouco e se repete em centenas de produtos: guarda
 * por alguns minutos para não gastar 1 de cada 3 chamadas da sincronização
 * (limite do Bling: 3 req/s) buscando o mesmo fornecedor de novo.
 */
const CONTATO_TTL_MS = 10 * 60 * 1000;
const cacheContatos = new Map<string, { expiraEm: number; contato: Awaited<ReturnType<typeof BlingService.getContact>> }>();

async function obterContatoBling(accountId: string, contatoId: number) {
  const chave = `${accountId}:${contatoId}`;
  const cache = cacheContatos.get(chave);
  if (cache && cache.expiraEm > Date.now()) return cache.contato;
  const contato = await BlingService.getContact(accountId, contatoId);
  cacheContatos.set(chave, { contato, expiraEm: Date.now() + CONTATO_TTL_MS });
  if (cacheContatos.size > 2000) cacheContatos.clear();
  return contato;
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

  const contato = await obterContatoBling(accountId, padrao.fornecedor.id);

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

export interface ResultadoComponentesKit {
  /** Componentes do Bling que não existem localmente (kit fica sem custo até chegarem). */
  faltando: string[];
}

export async function sincronizarComponentesKitBling(
  kitProdutoId: string,
  detalhe: BlingProduct,
  resolverComponenteLocal: (blingIdComponente: string) => Promise<string | null>
): Promise<ResultadoComponentesKit> {
  if (!detalhe.estrutura?.componentes) return { faltando: [] };

  const faltando: string[] = [];
  const presentes = new Set<string>();

  for (const componenteBling of detalhe.estrutura.componentes) {
    const componenteLocalId = await resolverComponenteLocal(
      String(componenteBling.produto.id)
    );
    if (!componenteLocalId) {
      faltando.push(String(componenteBling.produto.id));
      continue;
    }
    presentes.add(componenteLocalId);

    await prisma.componente.upsert({
      where: { kitId_produtoId: { kitId: kitProdutoId, produtoId: componenteLocalId } },
      update: { quantidade: componenteBling.quantidade },
      create: {
        kitId: kitProdutoId,
        produtoId: componenteLocalId,
        quantidade: componenteBling.quantidade,
      },
    });
  }

  // Componente que saiu da estrutura no Bling sai aqui também — antes ficava
  // para sempre e inflava o custo do kit e a demanda da reposição. Só remove
  // quando a estrutura veio completa (nenhum componente faltando localmente),
  // para não apagar nada por causa de um componente ainda não importado.
  if (faltando.length === 0) {
    await prisma.componente.deleteMany({
      where: { kitId: kitProdutoId, produtoId: { notIn: [...presentes] } },
    });
  }

  return { faltando };
}

export async function sincronizarProdutoUnico(
  accountId: string,
  userId: string,
  blingProdutoId: number,
  profundidade = 0
): Promise<AplicarDetalheResultado> {
  const blingIdStr = String(blingProdutoId);
  const detalhe = await BlingService.getProductById(accountId, blingProdutoId);
  const skuBruto = BlingService.extractSKU(detalhe);
  if (!skuBruto) {
    // Pai de variações costuma vir sem código: o que se vende e se estoca são
    // as variações (cada uma com SKU). Importa as variações e ignora o pai.
    const variacoes = detalhe.variacoes ?? [];
    if (variacoes.length > 0 && profundidade === 0) {
      let importadas = 0;
      for (const variacao of variacoes) {
        try {
          await sincronizarProdutoUnico(accountId, userId, variacao.id, profundidade + 1);
          importadas++;
        } catch (erro) {
          if (!(erro instanceof BlingProdutoIgnorado)) throw erro;
        }
      }
      throw new BlingProdutoIgnorado(
        `"${detalhe.nome}" é pai de variações no Bling — ${importadas} variação(ões) importada(s) com o próprio SKU.`
      );
    }
    throw new BlingProdutoIgnorado(
      `"${detalhe.nome}" (id ${blingProdutoId}) está sem código (SKU) no Bling — preencha o código no Bling para ele entrar no estoque.`
    );
  }
  const sku = normalizeSku(skuBruto);

  // blingId manda; SKU só vale para produto ainda sem blingId (cadastrado à
  // mão ou por planilha). Antes o OR podia pegar outro produto com o mesmo SKU
  // e tentar gravar um blingId que já era de outro (erro de unicidade).
  let existente: { id: string } | null =
    (await prisma.produto.findUnique({
      where: { userId_blingId: { userId, blingId: blingIdStr } },
      select: { id: true },
    })) ??
    (await prisma.produto.findFirst({
      where: { userId, sku, blingId: null },
      select: { id: true },
    }));
  if (!existente) {
    const skuOcupado = await prisma.produto.findFirst({
      where: { userId, sku, blingId: { not: null } },
      select: { id: true, blingId: true, ativo: true },
    });
    if (skuOcupado && !skuOcupado.ativo) {
      // Produto excluído e recriado no Bling com o mesmo SKU: o cadastro
      // local (inativo) passa a apontar para o novo id do Bling.
      existente = { id: skuOcupado.id };
    } else if (skuOcupado) {
      throw new Error(
        `SKU ${sku} já pertence ao produto ${skuOcupado.blingId} do Bling — há dois cadastros ativos no Bling com o mesmo SKU.`
      );
    }
  }

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
        if (componente) return componente.id;
        // Componente ainda não importado (a sincronização incremental pode
        // trazer o kit antes dele): importa agora, um nível só.
        if (profundidade > 0) return null;
        try {
          const importado = await sincronizarProdutoUnico(accountId, userId, Number(blingIdComponente), profundidade + 1);
          return importado.produtoId;
        } catch {
          return null;
        }
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
    select: { id: true, isKit: true, estoques: { select: { armazemId: true, quantidade: true } } },
  });
  // Saldo de kit no Bling é virtual (calculado dos componentes): gravar aqui
  // contaria o mesmo estoque duas vezes. A sincronização em lote já pulava kits.
  if (!produtoLocal || produtoLocal.isKit) return;

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
      const mesmoNome = armazensExistentes.find(
        (a) =>
          !a.blingDepositoId &&
          a.tipo === "LOCAL" &&
          a.nome.trim().toLowerCase() === deposit.descricao.trim().toLowerCase()
      );
      const unicoLocalSemDeposito =
        deposit.padrao &&
        armazensExistentes.filter((a) => !a.blingDepositoId && a.tipo === "LOCAL").length === 1
          ? armazensExistentes.find((a) => !a.blingDepositoId && a.tipo === "LOCAL")
          : undefined;
      const paraVincular = mesmoNome ?? unicoLocalSemDeposito;
      if (paraVincular) {
        const vinculado = await prisma.armazem.update({
          where: { id: paraVincular.id },
          data: { blingDepositoId: depositoId },
        });
        paraVincular.blingDepositoId = depositoId;
        armazemPorDeposito.set(depositoId, vinculado);
        continue;
      }
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
