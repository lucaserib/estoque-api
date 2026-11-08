import type { UserRole } from "@prisma/client";
import { type AcaoPermissao, podeVer } from "@/lib/permissoes";
import type { AreaDiagnostico, ItemDiagnostico } from "@/modules/controle/diagnostico";

interface Sugestao {
  texto: string;
  permissao: AcaoPermissao | null;
}

const FIXAS: Record<"reposicao" | "financeiro" | "anuncios" | "produtos" | "geral", Sugestao[]> = {
  reposicao: [
    { texto: "O que preciso comprar esta semana?", permissao: "PEDIDOS_COMPRA_VER" },
    { texto: "O que vai acabar antes de o fornecedor entregar?", permissao: "PEDIDOS_COMPRA_VER" },
    { texto: "O que devo mandar para o Full agora?", permissao: "PEDIDOS_COMPRA_VER" },
    { texto: "Onde tenho dinheiro parado em estoque?", permissao: "VER_CUSTO" },
  ],
  financeiro: [
    { texto: "Por que minha margem caiu este mês?", permissao: "FINANCEIRO_VER" },
    { texto: "Compare este mês com o mês passado.", permissao: "FINANCEIRO_VER" },
    { texto: "Quais produtos dão mais lucro?", permissao: "FINANCEIRO_VER" },
    { texto: "Quanto faturei com frete este mês?", permissao: "FINANCEIRO_VER" },
  ],
  anuncios: [
    { texto: "Quais anúncios estão perdendo venda?", permissao: "VENDAS_ML_VER" },
    { texto: "Tenho anúncio vendendo abaixo do custo?", permissao: "VENDAS_ML_VER" },
    { texto: "Quais anúncios estão sem produto vinculado?", permissao: "VENDAS_ML_VER" },
    { texto: "Como está meu estoque no Full?", permissao: "PEDIDOS_COMPRA_VER" },
  ],
  produtos: [
    { texto: "Quais produtos estão com cadastro incompleto?", permissao: null },
    { texto: "Quais produtos mais venderam nos últimos 30 dias?", permissao: "FINANCEIRO_VER" },
    { texto: "Tenho produto sem custo cadastrado?", permissao: null },
    { texto: "Qual produto está parado há mais tempo?", permissao: "VER_CUSTO" },
  ],
  geral: [
    { texto: "Como está minha loja hoje?", permissao: null },
    { texto: "O que preciso comprar esta semana?", permissao: "PEDIDOS_COMPRA_VER" },
    { texto: "Quanto vendi este mês e qual foi a margem?", permissao: "FINANCEIRO_VER" },
    { texto: "Quais anúncios estão perdendo venda?", permissao: "VENDAS_ML_VER" },
    { texto: "Por onde começo a arrumar minha loja?", permissao: null },
  ],
};

const AREA_DA_PAGINA: Array<[string, keyof typeof FIXAS, AreaDiagnostico | null]> = [
  ["/reposicao", "reposicao", "estoque"],
  ["/gestao-pedidos", "reposicao", "estoque"],
  ["/estoque", "reposicao", "estoque"],
  ["/financeiro", "financeiro", "financeiro"],
  ["/mercado-livre", "anuncios", "anuncios"],
  ["/produtos", "produtos", "cadastro"],
];

export function perguntaDoItem(item: Pick<ItemDiagnostico, "id" | "area">): Sugestao | null {
  const { id } = item;
  if (id === "estoque-zerado-vendendo") return { texto: "Quais produtos vendem e estão sem estoque?", permissao: "PEDIDOS_COMPRA_VER" };
  if (id === "estoque-ruptura-prevista") return { texto: "O que vai acabar antes da próxima compra chegar?", permissao: "PEDIDOS_COMPRA_VER" };
  if (id === "estoque-parado") return { texto: "Onde tenho dinheiro parado em estoque?", permissao: "VER_CUSTO" };
  if (id === "cadastro-margem_negativa") return { texto: "Quais produtos estão dando prejuízo?", permissao: "VER_CUSTO" };
  if (id === "cadastro-sem_custo") return { texto: "Quais produtos estão sem custo e como isso afeta meu lucro?", permissao: null };
  if (id.startsWith("cadastro-")) return { texto: "Quais produtos estão com cadastro incompleto?", permissao: null };
  if (id === "anuncios-sem_vinculo") return { texto: "Quais anúncios estão sem produto vinculado?", permissao: "VENDAS_ML_VER" };
  if (id === "anuncios-preco_abaixo_custo") return { texto: "Tenho anúncio vendendo abaixo do custo?", permissao: "VENDAS_ML_VER" };
  if (id.startsWith("anuncios-")) return { texto: "Quais anúncios estão perdendo venda?", permissao: "VENDAS_ML_VER" };
  if (id === "dre-vendas-sem-custo") return { texto: "Por que meu lucro do mês pode estar errado?", permissao: "FINANCEIRO_VER" };
  if (id.startsWith("dre-")) return { texto: "O que falta para o meu DRE ficar confiável?", permissao: "FINANCEIRO_VER" };
  if (item.area === "integracoes") return { texto: "O que está faltando configurar na minha loja?", permissao: null };
  return null;
}

export function sugestoesParaPagina(
  pagina: string | null | undefined,
  papel: UserRole,
  itensDiagnostico: Array<Pick<ItemDiagnostico, "id" | "area">> = [],
  quantidade = 4
): string[] {
  const caminho = pagina ?? "/";
  const correspondencia = AREA_DA_PAGINA.find(([prefixo]) => caminho.startsWith(prefixo));
  const grupo = correspondencia?.[1] ?? "geral";
  const area = correspondencia?.[2] ?? null;

  const doDiagnostico = itensDiagnostico
    .filter((item) => area === null || item.area === area)
    .map(perguntaDoItem)
    .filter((s): s is Sugestao => s !== null);

  const vistas = new Set<string>();
  return [...doDiagnostico, ...FIXAS[grupo], ...FIXAS.geral]
    .filter((s) => s.permissao === null || podeVer(papel, s.permissao))
    .map((s) => s.texto)
    .filter((texto) => (vistas.has(texto) ? false : (vistas.add(texto), true)))
    .slice(0, quantidade);
}
