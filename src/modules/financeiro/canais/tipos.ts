import { CanalVenda, Confianca, StatusVendaCanal } from "@prisma/client";

export interface ContaCanal {
  contaCanalId: string;
  userId: string;
}

export interface ItemVendaCanalNormalizado {
  anuncioExternoId: string;
  variacaoExternaId: string | null;
  sku: string | null;
  titulo: string;
  quantidade: number;
  precoUnitario: number;
  precoCheio: number | null;
  tarifaTotal: number | null;
}

export interface VendaCanalNormalizada {
  pedidoExternoId: string;
  pacoteExternoId: string | null;
  dataVenda: Date;
  dataCancelamento: Date | null;
  dataLiberacao: Date | null;
  status: StatusVendaCanal;
  logistica: string | null;
  envioExternoId: string | null;
  pagamentoExternoId: string | null;
  freteComprador: number;
  valorEstornado?: number;
  descontoVendedorTotal: number;
  descontoCusteadoPeloMlTotal: number;
  atualizadoNoCanalEm: Date;
  itens: ItemVendaCanalNormalizado[];
  origemReal?: { canal: CanalVenda; pedidoExternoId: string } | null;
}

export interface CustoEnvioNormalizado {
  valor: number | null;
  confianca: Confianca;
}

export interface EnvioNormalizado {
  logistica: string | null;
  confianca: Confianca;
}

export interface LiberacaoPagamentoNormalizada {
  dataLiberacao: Date | null;
  valorLiquido: number | null;
  confianca: Confianca;
}

export interface PedidoAlterado {
  pedidoExternoId: string;
  atualizadoNoCanalEm: Date;
}

export interface PaginaPedidos {
  pedidos: PedidoAlterado[];
  cursor: string | null;
  temMais: boolean;
}

export interface GastoAdsNormalizado {
  campanhaExternaId: string | null;
  anuncioExternoId: string | null;
  custo: number;
  cliques: number | null;
  impressoes: number | null;
  vendasAtribuidas: number | null;
  receitaAtribuida: number | null;
}

export interface CobrancaNormalizada {
  detalheExternoId: string;
  tipoExterno: string;
  tipoNormalizado: string;
  valor: number;
  pedidoExternoId: string | null;
  anuncioExternoId: string | null;
  data: Date;
  coberturaPedido: boolean;
}

export interface LiberacaoNormalizada {
  pedidoExternoId: string;
  valor: number;
  dataLiberacao: Date;
}

export interface CobrancaPagamentoNormalizada {
  nome: string;
  tipo: string;
  valor: number;
  estornado: number;
  destino: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PagamentoNormalizado {
  pagamentoExternoId: string;
  tarifaVenda: number;
  freteVendedor: number;
  retencaoDividas: number;
  valorLiquidoReceber: number | null;
  dataLiberacao: Date | null;
  statusLiberacao: string | null;
  cobrancas: CobrancaPagamentoNormalizada[];
  desconhecidos: string[];
}

export interface AdaptadorCanalFinanceiro {
  canal: CanalVenda;
  listarPedidosAlterados(
    conta: ContaCanal,
    desde: Date,
    ate: Date,
    cursor?: string | null
  ): Promise<PaginaPedidos>;
  obterPedido(
    conta: ContaCanal,
    pedidoExternoId: string
  ): Promise<VendaCanalNormalizada | null>;
  obterCustoEnvio?(
    conta: ContaCanal,
    envioId: string
  ): Promise<CustoEnvioNormalizado>;
  obterEnvio?(conta: ContaCanal, envioId: string): Promise<EnvioNormalizado>;
  obterLiberacaoPagamento?(
    conta: ContaCanal,
    pedidoExternoId: string
  ): Promise<LiberacaoPagamentoNormalizada>;
  obterDescontos?(conta: ContaCanal, pedidoExternoId: string): Promise<unknown>;
  obterPagamentoDetalhado?(
    conta: ContaCanal,
    pagamentoExternoId: string
  ): Promise<PagamentoNormalizado>;
  listarGastosAds?(conta: ContaCanal, dia: Date): Promise<GastoAdsNormalizado[]>;
  listarCobrancas?(
    conta: ContaCanal,
    mesReferencia: string
  ): Promise<CobrancaNormalizada[]>;
  listarLiberacoes?(
    conta: ContaCanal,
    desde: Date,
    ate: Date
  ): Promise<LiberacaoNormalizada[]>;
}
