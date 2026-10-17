import { CanalVenda, Confianca, StatusVendaCanal } from "@prisma/client";

export interface ContaCanal {
  /** Identificador da conta no canal (ex.: MercadoLivreAccount.id) — cada adaptador resolve o que precisar a partir dele. */
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
  /** Já é o total da linha (quantidade já aplicada pelo mapeador), não por unidade. */
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
  freteComprador: number;
  /** Nível do pedido inteiro — a camada de ingestão rateia entre os itens. */
  descontoVendedorTotal: number;
  descontoCusteadoPeloMlTotal: number;
  atualizadoNoCanalEm: Date;
  itens: ItemVendaCanalNormalizado[];
  /** Preenchido só por adaptadores que espelham pedidos de outro canal (ex.: ERP espelhando o ML). Ausente = este pedido é a própria origem. */
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

/**
 * Contrato estável entre o domínio financeiro e cada canal de venda. O
 * domínio só conhece os tipos `*Normalizada` acima — nada aqui menciona
 * Mercado Livre, Shopee ou qualquer API específica. Capacidades opcionais
 * ausentes (`undefined`) significam "o canal não informa isso", tratado na
 * tela como dado faltante, nunca como zero.
 */
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
