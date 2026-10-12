import { calcularMargemUnitaria } from "./margem";

export type SeveridadePendencia = "critica" | "atencao" | "informativa";

export interface Pendencia {
  codigo: string;
  severidade: SeveridadePendencia;
  mensagem: string;
  acao: string;
}

export interface ProdutoMLParaPendencias {
  mlStatus: string;
  mlPrice: number;
  mlCustoFrete: number | null;
  mlTarifaVenda: number | null;
  mlCustosAtualizadosEm: Date | null;
  mlFreeShipping: boolean;
}

export interface ProdutoParaPendencias {
  isKit: boolean;
  custoMedio: number | null;
  precoVenda: number | null;
  ean: bigint | null;
  componentes: Array<{ produto: { custoMedio: number | null } }>;
  fornecedores: Array<{ principal: boolean; prazoEntregaDias: number | null }>;
  produtosMercadoLivre: ProdutoMLParaPendencias[];
  /** Pré-computado pelo chamador (comparação com a última sincronização do Bling). */
  estoqueDivergente: boolean;
  /** Pré-computado pelo chamador (módulo financeiro — venda sem custo, frete ou vínculo nos últimos 30 dias). */
  vendaIncompleta: boolean;
}

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export function calcularPendencias(
  produto: ProdutoParaPendencias
): Pendencia[] {
  const pendencias: Pendencia[] = [];

  const semCusto = produto.isKit
    ? produto.componentes.some((c) => c.produto.custoMedio == null)
    : produto.custoMedio == null;

  if (semCusto) {
    pendencias.push({
      codigo: "SEM_CUSTO",
      severidade: "critica",
      mensagem: produto.isKit
        ? "Um ou mais componentes do kit não têm custo definido"
        : "Produto sem custo médio definido",
      acao: "Definir custo",
    });
  }

  if (produto.fornecedores.length === 0) {
    pendencias.push({
      codigo: "SEM_FORNECEDOR",
      severidade: "critica",
      mensagem: "Produto sem fornecedor cadastrado",
      acao: "Cadastrar fornecedor",
    });
  } else if (!produto.fornecedores.some((f) => f.principal)) {
    pendencias.push({
      codigo: "SEM_FORNECEDOR_PRINCIPAL",
      severidade: "atencao",
      mensagem:
        "Produto tem fornecedores cadastrados, mas nenhum marcado como principal",
      acao: "Definir fornecedor principal",
    });
  }

  const anunciosAtivos = produto.produtosMercadoLivre.filter(
    (p) => p.mlStatus === "active"
  );

  const temPrecoVenda = produto.precoVenda != null;
  const temAnuncioComPreco = anunciosAtivos.some((a) => a.mlPrice > 0);
  if (!temPrecoVenda && !temAnuncioComPreco) {
    pendencias.push({
      codigo: "SEM_PRECO",
      severidade: "critica",
      mensagem:
        "Produto sem preço de venda definido e sem anúncio ativo com preço",
      acao: "Definir preço de venda",
    });
  }

  const agora = Date.now();
  const anuncioComFretePendente = anunciosAtivos.find(
    (a) =>
      a.mlFreeShipping &&
      (a.mlCustoFrete == null ||
        !a.mlCustosAtualizadosEm ||
        agora - a.mlCustosAtualizadosEm.getTime() > SETE_DIAS_MS)
  );
  if (anuncioComFretePendente) {
    pendencias.push({
      codigo: "SEM_FRETE",
      severidade: "atencao",
      mensagem:
        "Anúncio ativo com frete grátis sem custo de frete atualizado nos últimos 7 dias",
      acao: "Sincronizar anúncio",
    });
  }

  if (anunciosAtivos.some((a) => a.mlTarifaVenda == null)) {
    pendencias.push({
      codigo: "SEM_TARIFA",
      severidade: "atencao",
      mensagem: "Anúncio ativo sem tarifa de venda calculada",
      acao: "Sincronizar anúncio",
    });
  }

  const fornecedorPrincipal = produto.fornecedores.find((f) => f.principal);
  if (fornecedorPrincipal && fornecedorPrincipal.prazoEntregaDias == null) {
    pendencias.push({
      codigo: "SEM_PRAZO_FORNECEDOR",
      severidade: "atencao",
      mensagem:
        "Fornecedor principal sem prazo de entrega — a reposição usa o padrão",
      acao: "Definir prazo de entrega",
    });
  }

  const custoParaMargem = semCusto
    ? null
    : produto.isKit
    ? produto.componentes.reduce(
        (sum, c) => sum + (c.produto.custoMedio ?? 0),
        0
      )
    : produto.custoMedio;

  const anuncioParaMargem = anunciosAtivos[0];
  const margem = calcularMargemUnitaria({
    precoVenda: anuncioParaMargem?.mlPrice ?? produto.precoVenda,
    tarifa: anuncioParaMargem ? anuncioParaMargem.mlTarifaVenda : 0,
    frete: anuncioParaMargem ? anuncioParaMargem.mlCustoFrete : 0,
    custo: custoParaMargem,
  });
  if (margem.completo && margem.margemValor !== null && margem.margemValor < 0) {
    pendencias.push({
      codigo: "MARGEM_NEGATIVA",
      severidade: "critica",
      mensagem: "Margem calculada é negativa",
      acao: "Revisar preço ou custo",
    });
  }

  if (produto.estoqueDivergente) {
    pendencias.push({
      codigo: "ESTOQUE_DIVERGENTE",
      severidade: "atencao",
      mensagem: "Saldo local diverge do último valor sincronizado do Bling",
      acao: "Sincronizar estoque",
    });
  }

  if (produto.vendaIncompleta) {
    pendencias.push({
      codigo: "VENDA_INCOMPLETA",
      severidade: "atencao",
      mensagem: "Teve venda sem custo, frete ou vínculo completo nos últimos 30 dias",
      acao: "Ver vendas no Financeiro",
    });
  }

  if (produto.ean == null) {
    pendencias.push({
      codigo: "SEM_EAN",
      severidade: "informativa",
      mensagem: "Produto sem GTIN/EAN válido",
      acao: "Cadastrar EAN",
    });
  }

  if (produto.produtosMercadoLivre.length === 0) {
    pendencias.push({
      codigo: "SEM_VINCULO_ML",
      severidade: "informativa",
      mensagem: "Produto ativo sem anúncio vinculado no Mercado Livre",
      acao: "Vincular anúncio",
    });
  }

  return pendencias;
}
