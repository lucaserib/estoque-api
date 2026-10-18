/**
 * Banco em memória para os testes do financeiro. Implementa só o pedaço do
 * Prisma que o motor de cálculo, a ingestão e os relatórios usam — o
 * suficiente para testar as regras de ponta a ponta sem mockar cada consulta.
 */
type Registro = Record<string, unknown>;

function comparar(valor: unknown, condicao: unknown): boolean {
  if (condicao === undefined) return true;
  if (condicao === null) return valor === null || valor === undefined;
  if (condicao instanceof Date) return valor instanceof Date && valor.getTime() === condicao.getTime();
  if (typeof condicao !== "object" || Array.isArray(condicao)) return valor === condicao;

  const c = condicao as Record<string, unknown>;
  const num = (v: unknown) => (v instanceof Date ? v.getTime() : (v as number));
  if ("gte" in c && c.gte !== undefined && !(valor != null && num(valor) >= num(c.gte))) return false;
  if ("gt" in c && c.gt !== undefined && !(valor != null && num(valor) > num(c.gt))) return false;
  if ("lte" in c && c.lte !== undefined && !(valor != null && num(valor) <= num(c.lte))) return false;
  if ("lt" in c && c.lt !== undefined && !(valor != null && num(valor) < num(c.lt))) return false;
  if ("in" in c && !(c.in as unknown[]).includes(valor)) return false;
  if ("notIn" in c && (c.notIn as unknown[]).includes(valor)) return false;
  if ("not" in c && comparar(valor, c.not)) return false;
  if ("contains" in c && !(typeof valor === "string" && valor.includes(String(c.contains)))) return false;
  if ("equals" in c && valor !== c.equals) return false;
  return true;
}

export function atende(registro: Registro, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  for (const [chave, condicao] of Object.entries(where)) {
    if (chave === "OR") {
      if (!(condicao as Record<string, unknown>[]).some((w) => atende(registro, w))) return false;
      continue;
    }
    if (chave === "AND") {
      if (!(condicao as Record<string, unknown>[]).every((w) => atende(registro, w))) return false;
      continue;
    }
    if (chave === "NOT") {
      if (atende(registro, condicao as Record<string, unknown>)) return false;
      continue;
    }
    const valor = registro[chave];
    if (
      condicao &&
      typeof condicao === "object" &&
      !(condicao instanceof Date) &&
      "some" in (condicao as Record<string, unknown>)
    ) {
      const lista = (valor as Registro[] | undefined) ?? [];
      if (!lista.some((item) => atende(item, (condicao as { some: Record<string, unknown> }).some))) return false;
      continue;
    }
    if (
      condicao &&
      typeof condicao === "object" &&
      !(condicao instanceof Date) &&
      valor &&
      typeof valor === "object" &&
      !(valor instanceof Date) &&
      !Array.isArray(valor)
    ) {
      if (!atende(valor as Registro, condicao as Record<string, unknown>)) return false;
      continue;
    }
    if (!comparar(valor, condicao)) return false;
  }
  return true;
}

function ordenar<T extends Registro>(lista: T[], orderBy: unknown): T[] {
  const regras = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Array<Record<string, "asc" | "desc">>;
  if (regras.length === 0) return lista;
  return [...lista].sort((a, b) => {
    for (const regra of regras) {
      const [campo, direcao] = Object.entries(regra)[0];
      const va = a[campo] instanceof Date ? (a[campo] as Date).getTime() : (a[campo] as number);
      const vb = b[campo] instanceof Date ? (b[campo] as Date).getTime() : (b[campo] as number);
      if (va === vb) continue;
      return (va < vb ? -1 : 1) * (direcao === "desc" ? -1 : 1);
    }
    return 0;
  });
}

let contador = 0;
const novoId = () => `id-${++contador}`;

export interface VendaFalsa extends Registro {
  id: string;
  userId: string;
  canal: string;
  contaCanalId: string;
  pedidoExternoId: string;
  dataVenda: Date;
  status: string;
  itens: Registro[];
}

export function criarBancoFalso() {
  const dados = {
    vendas: [] as VendaFalsa[],
    lancamentos: [] as Registro[],
    cobrancas: [] as Registro[],
    ads: [] as Registro[],
    config: null as Registro | null,
    produtos: [] as Registro[],
    contasFinanceiras: [] as Registro[],
    contasMl: [] as Registro[],
    cobrancasPagamento: [] as Registro[],
  };

  const vendaComPadroes = (parcial: Partial<VendaFalsa>): VendaFalsa => ({
    id: novoId(),
    userId: "user-1",
    canal: "MERCADO_LIVRE",
    contaCanalId: "conta-1",
    pedidoExternoId: String(contador + 1000),
    pacoteExternoId: null,
    dataVenda: new Date("2026-10-10T15:00:00Z"),
    dataCancelamento: null,
    dataLiberacao: null,
    status: "PAGA",
    logistica: "fulfillment",
    envioExternoId: "envio",
    faturamentoBruto: 0,
    valorEstornado: 0,
    descontoVendedor: 0,
    tarifaVenda: 0,
    freteVendedor: 0,
    freteComprador: 0,
    impostoEstimado: 0,
    adsAtribuido: 0,
    cmv: 0,
    outrosCustos: 0,
    margemContribuicao: 0,
    valorLiquidoReceber: null,
    retencaoDividas: 0,
    statusLiberacao: null,
    completo: true,
    faltando: [],
    freteConfianca: "CONFIRMADO",
    freteOrigem: "PAGAMENTO_CONFIRMADO",
    freteAjusteManual: null,
    freteAjusteManualMotivo: null,
    enriquecidoEm: new Date("2026-10-10T16:00:00Z"),
    enriquecimentoTentativas: 0,
    enriquecimentoErro: null,
    atualizadoNoCanalEm: new Date("2026-10-10T15:00:00Z"),
    itens: [],
    ...parcial,
  });

  const prisma = {
    configuracaoGeral: {
      findUnique: async () => dados.config,
    },
    vendaCanal: {
      findMany: async (args: { where?: Record<string, unknown>; orderBy?: unknown; take?: number; skip?: number } = {}) => {
        let lista = dados.vendas.filter((v) => atende(v, args.where));
        lista = ordenar(lista, args.orderBy);
        if (args.skip) lista = lista.slice(args.skip);
        if (args.take != null) lista = lista.slice(0, args.take);
        return lista.map((v) => ({ ...v, cobrancasPagamento: dados.cobrancasPagamento.filter((c) => c.vendaId === v.id) }));
      },
      findFirst: async (args: { where?: Record<string, unknown> } = {}) => dados.vendas.find((v) => atende(v, args.where)) ?? null,
      findUnique: async (args: { where: Record<string, unknown> }) => {
        const chave = args.where.userId_canal_pedidoExternoId as Registro | undefined;
        if (chave) {
          return (
            dados.vendas.find(
              (v) => v.userId === chave.userId && v.canal === chave.canal && v.pedidoExternoId === chave.pedidoExternoId
            ) ?? null
          );
        }
        return dados.vendas.find((v) => v.id === args.where.id) ?? null;
      },
      count: async (args: { where?: Record<string, unknown> } = {}) => dados.vendas.filter((v) => atende(v, args.where)).length,
      aggregate: async (args: { where?: Record<string, unknown>; _sum?: Record<string, boolean> }) => {
        const lista = dados.vendas.filter((v) => atende(v, args.where));
        const soma: Record<string, number | null> = {};
        for (const campo of Object.keys(args._sum ?? {})) {
          soma[campo] = lista.length === 0 ? null : lista.reduce((s, v) => s + ((v[campo] as number) ?? 0), 0);
        }
        return { _sum: soma, _count: { _all: lista.length } };
      },
      upsert: async (args: { where: Record<string, unknown>; create: Registro; update: Registro }) => {
        const chave = args.where.userId_canal_pedidoExternoId as Registro;
        const existente = dados.vendas.find(
          (v) => v.userId === chave.userId && v.canal === chave.canal && v.pedidoExternoId === chave.pedidoExternoId
        );
        if (existente) {
          Object.assign(existente, args.update);
          return existente;
        }
        const nova = vendaComPadroes(args.create as Partial<VendaFalsa>);
        dados.vendas.push(nova);
        return nova;
      },
      update: async (args: { where: { id: string }; data: Registro }) => {
        const venda = dados.vendas.find((v) => v.id === args.where.id);
        if (!venda) throw new Error("venda não encontrada");
        for (const [campo, valor] of Object.entries(args.data)) {
          if (valor && typeof valor === "object" && "increment" in (valor as Registro)) {
            venda[campo] = ((venda[campo] as number) ?? 0) + ((valor as { increment: number }).increment);
          } else {
            venda[campo] = valor;
          }
        }
        return venda;
      },
      updateMany: async (args: { where?: Record<string, unknown>; data: Registro }) => {
        const lista = dados.vendas.filter((v) => atende(v, args.where));
        for (const v of lista) Object.assign(v, args.data);
        return { count: lista.length };
      },
    },
    vendaCanalItem: {
      deleteMany: async (args: { where: { vendaId: string } }) => {
        const venda = dados.vendas.find((v) => v.id === args.where.vendaId);
        if (venda) venda.itens = [];
        return { count: 0 };
      },
      createMany: async (args: { data: Registro[] }) => {
        for (const item of args.data) {
          const venda = dados.vendas.find((v) => v.id === item.vendaId);
          if (venda) venda.itens.push({ id: novoId(), descontoCusteadoMl: 0, ...item });
        }
        return { count: args.data.length };
      },
    },
    cobrancaPagamento: {
      upsert: async (args: { create: Registro }) => {
        dados.cobrancasPagamento.push({ id: novoId(), ...args.create });
        return args.create;
      },
    },
    lancamentoFinanceiro: {
      findMany: async (args: { where?: Record<string, unknown> } = {}) =>
        dados.lancamentos.filter((l) => atende(l, args.where)),
      aggregate: async (args: { where?: Record<string, unknown> }) => {
        const lista = dados.lancamentos.filter((l) => atende(l, args.where));
        return {
          _sum: { valor: lista.length === 0 ? null : lista.reduce((s, l) => s + (l.valor as number), 0) },
          _count: { _all: lista.length },
        };
      },
    },
    cobrancaCanal: {
      groupBy: async (args: { by: string[]; where?: Record<string, unknown> }) => {
        const grupos = new Map<string, number>();
        for (const c of dados.cobrancas.filter((x) => atende(x, args.where))) {
          const chave = String(c[args.by[0]]);
          grupos.set(chave, (grupos.get(chave) ?? 0) + (c.valor as number));
        }
        return [...grupos.entries()].map(([chave, valor]) => ({
          [args.by[0]]: chave,
          _sum: { valor },
          _count: { _all: 1 },
        }));
      },
      aggregate: async (args: { where?: Record<string, unknown> }) => {
        const lista = dados.cobrancas.filter((x) => atende(x, args.where));
        return { _sum: { valor: lista.reduce((s, c) => s + (c.valor as number), 0) } };
      },
    },
    gastoAdsCanal: {
      aggregate: async (args: { where?: Record<string, unknown> }) => {
        const lista = dados.ads.filter((a) => atende(a, args.where));
        return {
          _sum: { custo: lista.length === 0 ? null : lista.reduce((s, a) => s + (a.custo as number), 0) },
          _count: { _all: lista.length },
        };
      },
    },
    produto: {
      findMany: async (args: { where?: Record<string, unknown> } = {}) => dados.produtos.filter((p) => atende(p, args.where)),
    },
    contaFinanceira: {
      findMany: async (args: { where?: Record<string, unknown> } = {}) =>
        dados.contasFinanceiras.filter((c) => atende(c, args.where)),
      findFirst: async (args: { where?: Record<string, unknown> } = {}) =>
        dados.contasFinanceiras.find((c) => atende(c, args.where)) ?? null,
      findUnique: async (args: { where: { userId_contaCanalId?: Registro } }) => {
        const chave = args.where.userId_contaCanalId;
        return (
          dados.contasFinanceiras.find((c) => c.userId === chave?.userId && c.contaCanalId === chave?.contaCanalId) ?? null
        );
      },
      create: async (args: { data: Registro }) => {
        const agora = new Date();
        const conta = { id: novoId(), ativo: true, createdAt: agora, updatedAt: agora, ...args.data };
        dados.contasFinanceiras.push(conta);
        return conta;
      },
      update: async (args: { where: { id: string }; data: Registro }) => {
        const conta = dados.contasFinanceiras.find((c) => c.id === args.where.id);
        Object.assign(conta as Registro, args.data, { updatedAt: new Date(Date.now() + 1) });
        return conta;
      },
    },
    mercadoLivreAccount: {
      findMany: async (args: { where?: Record<string, unknown> } = {}) => dados.contasMl.filter((c) => atende(c, args.where)),
    },
  };

  return { dados, prisma, venda: vendaComPadroes };
}
