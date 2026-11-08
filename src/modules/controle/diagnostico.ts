import { StatusVendaCanal, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withUserCache } from "@/lib/cache";
import { calcularTodasPendencias } from "@/services/pendenciasService";
import { calcularSaudeAnuncios } from "@/services/saudeAnunciosService";
import { calcularCapitalParadoConta, calcularReposicaoConta } from "@/services/reposicaoService";
import { inicioDoMes } from "@/modules/financeiro/dominio/periodo";
import { listarCobrancasNaoMapeadas } from "@/modules/financeiro/relatorios/cobrancasNaoMapeadas";

export type AreaDiagnostico = "integracoes" | "estoque" | "cadastro" | "anuncios" | "financeiro";
export type Gravidade = "critica" | "atencao" | "informativa";

export interface ItemDiagnostico {
  id: string;
  area: AreaDiagnostico;
  gravidade: Gravidade;
  titulo: string;
  descricao: string;
  quantidade: number;
  valorEmRisco: number | null;
  acao: { rotulo: string; href: string };
  exemplos: string[];
}

export interface ResumoArea {
  area: AreaDiagnostico;
  titulo: string;
  nota: number;
  problemas: number;
}

export interface Diagnostico {
  geradoEm: string;
  nota: number;
  classificacao: "excelente" | "boa" | "regular" | "critica";
  itens: ItemDiagnostico[];
  areas: ResumoArea[];
  contexto: {
    produtosAtivos: number;
    anunciosAtivos: number;
    vendasMes: number;
    mlConectado: boolean;
    blingConectado: boolean;
  };
  incompleto: AreaDiagnostico[];
}

export const TITULO_AREA: Record<AreaDiagnostico, string> = {
  integracoes: "Integrações",
  estoque: "Estoque",
  cadastro: "Cadastro",
  anuncios: "Anúncios",
  financeiro: "Financeiro e DRE",
};

const PESO: Record<Gravidade, number> = { critica: 14, atencao: 6, informativa: 2 };

export function calcularNota(itens: Array<Pick<ItemDiagnostico, "gravidade">>): number {
  const desconto = itens.reduce((total, item) => total + PESO[item.gravidade], 0);
  return Math.max(0, Math.min(100, 100 - desconto));
}

export function calcularNotaGeral(itens: Array<Pick<ItemDiagnostico, "gravidade" | "area">>): number {
  const areas = Object.keys(TITULO_AREA) as AreaDiagnostico[];
  const media = areas.reduce((total, area) => total + calcularNota(itens.filter((i) => i.area === area)), 0) / areas.length;
  const criticos = itens.filter((i) => i.gravidade === "critica").length;
  return Math.max(0, Math.round(media - criticos * 4));
}

export function classificar(nota: number): Diagnostico["classificacao"] {
  if (nota >= 90) return "excelente";
  if (nota >= 70) return "boa";
  if (nota >= 45) return "regular";
  return "critica";
}

const ORDEM_GRAVIDADE: Record<Gravidade, number> = { critica: 0, atencao: 1, informativa: 2 };

export function ordenarItens(itens: ItemDiagnostico[]): ItemDiagnostico[] {
  return [...itens].sort(
    (a, b) =>
      ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] ||
      (b.valorEmRisco ?? 0) - (a.valorEmRisco ?? 0) ||
      b.quantidade - a.quantidade
  );
}

export function resumirAreas(itens: ItemDiagnostico[]): ResumoArea[] {
  return (Object.keys(TITULO_AREA) as AreaDiagnostico[]).map((area) => {
    const daArea = itens.filter((i) => i.area === area);
    return { area, titulo: TITULO_AREA[area], nota: calcularNota(daArea), problemas: daArea.length };
  });
}

type Coletor = () => Promise<ItemDiagnostico[]>;

async function coletarIntegracoes(contaId: string): Promise<ItemDiagnostico[]> {
  const [contasMl, contasBling] = await Promise.all([
    prisma.mercadoLivreAccount.findMany({ where: { userId: contaId }, select: { isActive: true, nickname: true } }),
    prisma.blingAccount.findMany({ where: { userId: contaId }, select: { isActive: true } }),
  ]);
  const itens: ItemDiagnostico[] = [];

  if (contasMl.length === 0) {
    itens.push({
      id: "ml-desconectado",
      area: "integracoes",
      gravidade: "critica",
      titulo: "Mercado Livre não conectado",
      descricao: "Sem a conta do ML o Skubo não recebe vendas, Full, tarifas nem fretes.",
      quantidade: 1,
      valorEmRisco: null,
      acao: { rotulo: "Conectar", href: "/integracoes" },
      exemplos: [],
    });
  } else {
    const inativas = contasMl.filter((c) => !c.isActive);
    if (inativas.length > 0) {
      itens.push({
        id: "ml-reconectar",
        area: "integracoes",
        gravidade: "critica",
        titulo: "Conta do Mercado Livre precisa ser reconectada",
        descricao: "O acesso expirou ou foi revogado. Vendas novas não estão chegando.",
        quantidade: inativas.length,
        valorEmRisco: null,
        acao: { rotulo: "Reconectar", href: "/integracoes" },
        exemplos: inativas.map((c) => c.nickname ?? "Conta ML"),
      });
    }
  }

  if (contasBling.length === 0) {
    itens.push({
      id: "bling-desconectado",
      area: "integracoes",
      gravidade: "atencao",
      titulo: "Bling não conectado",
      descricao: "Com o Bling o Skubo traz custo, EAN, estoque e notas fiscais automaticamente.",
      quantidade: 1,
      valorEmRisco: null,
      acao: { rotulo: "Conectar", href: "/integracoes" },
      exemplos: [],
    });
  } else if (contasBling.every((c) => !c.isActive)) {
    itens.push({
      id: "bling-reconectar",
      area: "integracoes",
      gravidade: "critica",
      titulo: "Bling precisa ser reconectado",
      descricao: "O token do Bling expirou. Estoque e custos pararam de atualizar.",
      quantidade: 1,
      valorEmRisco: null,
      acao: { rotulo: "Reconectar", href: "/integracoes" },
      exemplos: [],
    });
  }

  return itens;
}

async function coletarEstoque(contaId: string): Promise<ItemDiagnostico[]> {
  const [reposicao, parados] = await Promise.all([
    calcularReposicaoConta(contaId),
    calcularCapitalParadoConta(contaId, 90),
  ]);
  const itens: ItemDiagnostico[] = [];

  const zerados = reposicao.sugestoes.filter((s) => !s.ehKit && s.demandaDiaria > 0 && s.estoqueDisponivel <= 0);
  if (zerados.length > 0) {
    itens.push({
      id: "estoque-zerado-vendendo",
      area: "estoque",
      gravidade: "critica",
      titulo: "Produtos que vendem e estão sem estoque",
      descricao: "Cada dia sem estoque é venda perdida e posição perdida no ranking do ML.",
      quantidade: zerados.length,
      valorEmRisco: null,
      acao: { rotulo: "Ver reposição", href: "/reposicao" },
      exemplos: zerados.slice(0, 5).map((s) => s.nome),
    });
  }

  const vaiFaltar = reposicao.sugestoes.filter(
    (s) => !s.ehKit && s.status === "critico" && s.estoqueDisponivel > 0
  );
  if (vaiFaltar.length > 0) {
    itens.push({
      id: "estoque-ruptura-prevista",
      area: "estoque",
      gravidade: "atencao",
      titulo: "Vão acabar antes da próxima compra chegar",
      descricao: "O estoque atual não cobre o prazo de entrega do fornecedor.",
      quantidade: vaiFaltar.length,
      valorEmRisco: vaiFaltar.reduce((t, s) => t + (s.custoTotalCompra ?? 0), 0) || null,
      acao: { rotulo: "Gerar pedidos de compra", href: "/reposicao" },
      exemplos: vaiFaltar.slice(0, 5).map((s) => s.nome),
    });
  }

  const comValor = parados.filter((p) => (p.valorParado ?? 0) > 0);
  if (comValor.length > 0) {
    itens.push({
      id: "estoque-parado",
      area: "estoque",
      gravidade: "informativa",
      titulo: "Capital parado há mais de 90 dias",
      descricao: "Produtos com estoque e sem venda há 3 meses. Considere promoção ou queima.",
      quantidade: comValor.length,
      valorEmRisco: comValor.reduce((t, p) => t + (p.valorParado ?? 0), 0),
      acao: { rotulo: "Ver produtos", href: "/reposicao" },
      exemplos: comValor.slice(0, 5).map((p) => p.nome),
    });
  }

  return itens;
}

const PENDENCIAS_CADASTRO: Record<string, { gravidade: Gravidade; titulo: string; descricao: string }> = {
  SEM_CUSTO: {
    gravidade: "critica",
    titulo: "Produtos sem custo",
    descricao: "Sem custo não existe margem nem lucro confiável no DRE.",
  },
  SEM_FORNECEDOR: {
    gravidade: "atencao",
    titulo: "Produtos sem fornecedor",
    descricao: "A reposição não consegue montar o pedido de compra desses itens.",
  },
  SEM_PRECO: {
    gravidade: "atencao",
    titulo: "Produtos sem preço de venda",
    descricao: "Sem preço o Skubo não calcula margem nem valor de estoque a venda.",
  },
  MARGEM_NEGATIVA: {
    gravidade: "critica",
    titulo: "Produtos com margem negativa",
    descricao: "Cada venda desses itens dá prejuízo com o preço e os custos atuais.",
  },
  ESTOQUE_DIVERGENTE: {
    gravidade: "atencao",
    titulo: "Estoque diferente do Bling",
    descricao: "O saldo no Skubo não bate com o do Bling. Sincronize ou ajuste.",
  },
};

async function coletarCadastro(contaId: string): Promise<ItemDiagnostico[]> {
  const pendencias = await calcularTodasPendencias(contaId);
  const porCodigo = new Map<string, string[]>();
  for (const item of pendencias) {
    for (const p of item.pendencias) {
      if (!PENDENCIAS_CADASTRO[p.codigo]) continue;
      const lista = porCodigo.get(p.codigo) ?? [];
      lista.push(item.nome);
      porCodigo.set(p.codigo, lista);
    }
  }
  return [...porCodigo.entries()].map(([codigo, nomes]) => ({
    id: `cadastro-${codigo.toLowerCase()}`,
    area: "cadastro" as const,
    gravidade: PENDENCIAS_CADASTRO[codigo].gravidade,
    titulo: PENDENCIAS_CADASTRO[codigo].titulo,
    descricao: PENDENCIAS_CADASTRO[codigo].descricao,
    quantidade: nomes.length,
    valorEmRisco: null,
    acao: { rotulo: "Corrigir", href: `/produtos?pendencia=${codigo}` },
    exemplos: nomes.slice(0, 5),
  }));
}

const GRAVIDADE_ANUNCIO: Record<string, Gravidade> = {
  PRECO_ABAIXO_CUSTO: "critica",
  SEM_VINCULO: "critica",
  SEM_ESTOQUE: "atencao",
  FULL_BAIXO: "atencao",
  PAUSADO: "informativa",
  SEM_TARIFA_FRETE: "informativa",
};

async function coletarAnuncios(contaId: string): Promise<ItemDiagnostico[]> {
  const saude = await calcularSaudeAnuncios(contaId);
  return saude.grupos
    .filter((g) => g.anuncios.length > 0)
    .map((g) => ({
      id: `anuncios-${g.categoria.toLowerCase()}`,
      area: "anuncios" as const,
      gravidade: GRAVIDADE_ANUNCIO[g.categoria] ?? "atencao",
      titulo: g.categoria === "SEM_VINCULO" ? "Anúncios sem produto vinculado" : `Anúncios: ${g.titulo.toLowerCase()}`,
      descricao: g.descricao,
      quantidade: g.anuncios.length,
      valorEmRisco: null,
      acao: { rotulo: g.acao, href: g.linkFiltro },
      exemplos: g.anuncios.slice(0, 5).map((a) => a.mlTitle),
    }));
}

async function coletarFinanceiro(contaId: string, agora: Date): Promise<ItemDiagnostico[]> {
  const desde = inicioDoMes(agora);
  const statusValidos = [StatusVendaCanal.PAGA, StatusVendaCanal.DEVOLVIDA_PARCIAL, StatusVendaCanal.EM_MEDIACAO];
  const [vendasMes, semCusto, aguardando, comFalha, config, despesasMes, cobrancas, contaBling, notasMes] = await Promise.all([
    prisma.vendaCanal.count({ where: { userId: contaId, dataVenda: { gte: desde }, status: { in: statusValidos } } }),
    prisma.vendaCanal.count({ where: { userId: contaId, dataVenda: { gte: desde }, status: { in: statusValidos }, cmv: null } }),
    prisma.vendaCanal.count({ where: { userId: contaId, dataVenda: { gte: desde }, enriquecidoEm: null, enriquecimentoErro: null } }),
    prisma.vendaCanal.count({ where: { userId: contaId, dataVenda: { gte: desde }, enriquecidoEm: null, enriquecimentoErro: { not: null } } }),
    prisma.configuracaoGeral.findUnique({ where: { userId: contaId }, select: { aliquotaImposto: true } }),
    prisma.lancamentoFinanceiro.count({ where: { userId: contaId, tipo: TipoLancamento.DESPESA, competencia: { gte: desde } } }),
    listarCobrancasNaoMapeadas(contaId).catch(() => []),
    prisma.blingAccount.findFirst({ where: { userId: contaId, isActive: true }, select: { id: true } }),
    prisma.notaFiscalVenda.count({ where: { userId: contaId, dataEmissao: { gte: desde } } }),
  ]);
  const itens: ItemDiagnostico[] = [];
  if (vendasMes === 0) return itens;

  if (semCusto > 0) {
    itens.push({
      id: "dre-vendas-sem-custo",
      area: "financeiro",
      gravidade: "critica",
      titulo: "Vendas do mês sem custo (CMV)",
      descricao: "O lucro do DRE está maior do que a realidade enquanto essas vendas não tiverem custo.",
      quantidade: semCusto,
      valorEmRisco: null,
      acao: { rotulo: "Ver vendas", href: "/financeiro/vendas" },
      exemplos: [],
    });
  }

  if (aguardando > 0) {
    itens.push({
      id: "dre-aguardando-pagamento",
      area: "financeiro",
      gravidade: "informativa",
      titulo: "Vendas aguardando tarifa e frete reais",
      descricao: "O Mercado Pago ainda não liberou o detalhe dessas vendas. Os valores podem mudar.",
      quantidade: aguardando,
      valorEmRisco: null,
      acao: { rotulo: "Ver sincronização", href: "/financeiro" },
      exemplos: [],
    });
  }

  if (comFalha > 0) {
    itens.push({
      id: "dre-falha-detalhe",
      area: "financeiro",
      gravidade: "atencao",
      titulo: "Vendas com erro ao buscar o pagamento",
      descricao: "Tarifa e frete dessas vendas estão estimados. Rode a conferência do mês.",
      quantidade: comFalha,
      valorEmRisco: null,
      acao: { rotulo: "Conferir mês", href: "/financeiro/conferencia" },
      exemplos: [],
    });
  }

  if (!config || config.aliquotaImposto <= 0) {
    itens.push({
      id: "dre-sem-imposto",
      area: "financeiro",
      gravidade: "atencao",
      titulo: "Alíquota de imposto não configurada",
      descricao: "Sem a alíquota o DRE ignora o imposto sobre as vendas e a margem fica inflada.",
      quantidade: 1,
      valorEmRisco: null,
      acao: { rotulo: "Configurar", href: "/financeiro/configuracoes" },
      exemplos: [],
    });
  }

  if (despesasMes === 0) {
    itens.push({
      id: "dre-sem-despesas",
      area: "financeiro",
      gravidade: "atencao",
      titulo: "Nenhuma despesa lançada no mês",
      descricao: "Sem aluguel, salários e ferramentas o lucro líquido do DRE não é real.",
      quantidade: 1,
      valorEmRisco: null,
      acao: { rotulo: "Lançar despesas", href: "/financeiro/lancamentos" },
      exemplos: [],
    });
  }

  if (cobrancas.length > 0) {
    itens.push({
      id: "dre-cobrancas-nao-classificadas",
      area: "financeiro",
      gravidade: "informativa",
      titulo: "Cobranças do Mercado Livre sem categoria",
      descricao: "Essas cobranças ainda não entram no lugar certo do DRE.",
      quantidade: cobrancas.length,
      valorEmRisco: null,
      acao: { rotulo: "Revisar", href: "/financeiro/conferencia" },
      exemplos: [],
    });
  }

  if (contaBling && notasMes === 0) {
    itens.push({
      id: "dre-sem-notas",
      area: "financeiro",
      gravidade: "informativa",
      titulo: "Notas fiscais do mês ainda não trazidas",
      descricao: "Traga as notas do Bling para ver o faturamento real com frete.",
      quantidade: 1,
      valorEmRisco: null,
      acao: { rotulo: "Ver faturamento", href: "/financeiro" },
      exemplos: [],
    });
  }

  return itens;
}

async function montarDiagnostico(contaId: string): Promise<Diagnostico> {
  const agora = new Date();
  const coletores: Array<[AreaDiagnostico, Coletor]> = [
    ["integracoes", () => coletarIntegracoes(contaId)],
    ["estoque", () => coletarEstoque(contaId)],
    ["cadastro", () => coletarCadastro(contaId)],
    ["anuncios", () => coletarAnuncios(contaId)],
    ["financeiro", () => coletarFinanceiro(contaId, agora)],
  ];

  const resultados = await Promise.allSettled(coletores.map(([, coletar]) => coletar()));
  const itens: ItemDiagnostico[] = [];
  const incompleto: AreaDiagnostico[] = [];
  resultados.forEach((resultado, indice) => {
    if (resultado.status === "fulfilled") itens.push(...resultado.value);
    else {
      incompleto.push(coletores[indice][0]);
      console.error(`[DIAGNOSTICO] Falha na área ${coletores[indice][0]}:`, resultado.reason);
    }
  });

  const [produtosAtivos, anunciosAtivos, vendasMes, mlConectado, blingConectado] = await Promise.all([
    prisma.produto.count({ where: { userId: contaId, ativo: true } }),
    prisma.produtoMercadoLivre.count({ where: { mercadoLivreAccount: { userId: contaId }, mlStatus: "active" } }),
    prisma.vendaCanal.count({ where: { userId: contaId, dataVenda: { gte: inicioDoMes(agora) } } }),
    prisma.mercadoLivreAccount.count({ where: { userId: contaId, isActive: true } }),
    prisma.blingAccount.count({ where: { userId: contaId, isActive: true } }),
  ]);

  const ordenados = ordenarItens(itens);
  const nota = calcularNotaGeral(ordenados);

  return {
    geradoEm: agora.toISOString(),
    nota,
    classificacao: classificar(nota),
    itens: ordenados,
    areas: resumirAreas(ordenados),
    contexto: {
      produtosAtivos,
      anunciosAtivos,
      vendasMes,
      mlConectado: mlConectado > 0,
      blingConectado: blingConectado > 0,
    },
    incompleto,
  };
}

export async function gerarDiagnostico(contaId: string, forcar = false): Promise<Diagnostico> {
  if (forcar) return montarDiagnostico(contaId);
  return withUserCache(contaId, "controle:diagnostico", () => montarDiagnostico(contaId), "default", "diagnostico");
}
