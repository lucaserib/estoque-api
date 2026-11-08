import type { UserRole } from "@prisma/client";
import { podeVer } from "@/lib/permissoes";
import type { FerramentaIa } from "../cliente";
import { prepararSaidaFerramenta } from "../seguranca";
import {
  buscarProdutos,
  detalheProduto,
  diagnosticoLoja,
  pendenciasCadastro,
  saudeAnuncios,
} from "./catalogo";
import { zodParaJsonSchema } from "./esquema";
import { capitalParado, sugestaoReposicao } from "./estoque";
import {
  compararPeriodos,
  faturamentoComFrete,
  resumoFinanceiro,
  vendasPorDia,
  vendasPorProduto,
} from "./financeiro";
import { type ContextoFerramenta, type DefinicaoFerramenta, ErroFerramenta } from "./tipos";

export const TODAS_AS_FERRAMENTAS: DefinicaoFerramenta[] = [
  diagnosticoLoja,
  resumoFinanceiro,
  compararPeriodos,
  vendasPorProduto,
  vendasPorDia,
  faturamentoComFrete,
  sugestaoReposicao,
  capitalParado,
  pendenciasCadastro,
  saudeAnuncios,
  buscarProdutos,
  detalheProduto,
];

export function ferramentasDoPapel(papel: UserRole): DefinicaoFerramenta[] {
  return TODAS_AS_FERRAMENTAS.filter((f) => f.permissao === null || podeVer(papel, f.permissao));
}

export function definicoesParaApi(ferramentas: DefinicaoFerramenta[]): FerramentaIa[] {
  return ferramentas.map((f) => ({
    name: f.nome,
    description: f.descricao,
    input_schema: zodParaJsonSchema(f.esquema) as FerramentaIa["input_schema"],
  }));
}

export function rotuloDaFerramenta(nome: string): string {
  return TODAS_AS_FERRAMENTAS.find((f) => f.nome === nome)?.rotulo ?? "Consultando os dados";
}

export function montarContextoFerramenta(
  usuario: { id: string; contaId: string; role: UserRole },
  agora: Date = new Date()
): ContextoFerramenta {
  return {
    contaId: usuario.contaId,
    userId: usuario.id,
    papel: usuario.role,
    podeVerCusto: podeVer(usuario.role, "VER_CUSTO"),
    agora,
  };
}

export interface ResultadoFerramenta {
  nome: string;
  rotulo: string;
  entrada: unknown;
  conteudo: string;
  erro: boolean;
  duracaoMs: number;
}

export async function executarFerramenta(
  nome: string,
  entradaBruta: unknown,
  contexto: ContextoFerramenta
): Promise<ResultadoFerramenta> {
  const inicio = Date.now();
  const definicao = ferramentasDoPapel(contexto.papel).find((f) => f.nome === nome);
  const base = { nome, rotulo: definicao?.rotulo ?? rotuloDaFerramenta(nome), entrada: entradaBruta };
  const falha = (mensagem: string): ResultadoFerramenta => ({
    ...base,
    conteudo: mensagem,
    erro: true,
    duracaoMs: Date.now() - inicio,
  });

  if (!definicao) return falha(`A ferramenta ${nome} não está disponível para o papel deste usuário.`);

  const entrada = definicao.esquema.safeParse(entradaBruta ?? {});
  if (!entrada.success) {
    return falha(`Entrada inválida para ${nome}: ${entrada.error.issues.map((i) => `${i.path.join(".") || "entrada"} ${i.message}`).join("; ")}`);
  }

  try {
    const saida = await definicao.executar(contexto, entrada.data);
    return {
      ...base,
      entrada: entrada.data,
      conteudo: prepararSaidaFerramenta(saida, contexto.podeVerCusto),
      erro: false,
      duracaoMs: Date.now() - inicio,
    };
  } catch (error) {
    if (error instanceof ErroFerramenta) return falha(error.message);
    console.error("[IA_FERRAMENTA] Falha ao executar", {
      ferramenta: nome,
      conta: contexto.contaId,
      erro: error instanceof Error ? error.name : "desconhecido",
    });
    return falha(`Não consegui consultar ${definicao.rotulo.toLowerCase()} agora. Diga ao usuário que esse dado está indisponível no momento.`);
  }
}
