import type { PrioridadeTarefa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type DiaCalendario, diaEmBrasilia, somarDiasAoDia } from "@/modules/financeiro/dominio/periodo";
import { type ContextoOperacao, exigirEdicao } from "./contexto";
import { diaParaTexto } from "./dominio/prazo";
import type { Recorrencia } from "./dominio/recorrencia";
import { criarTarefa } from "./tarefas";
import type { CartaoTarefa } from "./tipos";

export interface RotinaSugerida {
  chave: string;
  titulo: string;
  descricao: string;
  etiqueta: string;
  prioridade: PrioridadeTarefa;
  recorrencia: Recorrencia;
  checklist: string[];
  tela: { rotulo: string; href: string } | null;
}

const semanal = (dia: number): Recorrencia => ({ frequencia: "SEMANAL", intervalo: 1, diasSemana: [dia], diaDoMes: null, ate: null });
const mensal = (dia: number): Recorrencia => ({ frequencia: "MENSAL", intervalo: 1, diasSemana: [], diaDoMes: dia, ate: null });
const diaria: Recorrencia = { frequencia: "DIARIA", intervalo: 1, diasSemana: [], diaDoMes: null, ate: null };

export const ROTINAS_SUGERIDAS: RotinaSugerida[] = [
  {
    chave: "perguntas-ml",
    titulo: "Responder as perguntas do Mercado Livre",
    descricao: "Pergunta sem resposta derruba a conversão do anúncio. Meta: tudo respondido antes do fim do dia.",
    etiqueta: "Atendimento",
    prioridade: "ALTA",
    recorrencia: diaria,
    checklist: [],
    tela: null,
  },
  {
    chave: "full-semanal",
    titulo: "Enviar reposição para o Full",
    descricao: "Conferir o que está acabando no Full e montar o envio da semana.",
    etiqueta: "Full",
    prioridade: "ALTA",
    recorrencia: semanal(1),
    checklist: ["Conferir a sugestão de envio na Reposição", "Separar e etiquetar", "Agendar a entrega no Mercado Livre"],
    tela: { rotulo: "Reposição", href: "/reposicao" },
  },
  {
    chave: "central-controle",
    titulo: "Resolver os itens críticos da Central de controle",
    descricao: "Produto sem estoque vendendo, sem custo, margem negativa e anúncio sem vínculo.",
    etiqueta: "Estoque",
    prioridade: "MEDIA",
    recorrencia: semanal(1),
    checklist: [],
    tela: { rotulo: "Central de controle", href: "/controle" },
  },
  {
    chave: "pedidos-atrasados",
    titulo: "Cobrar pedidos de compra atrasados",
    descricao: "Fornecedor que atrasa vira ruptura. Ligar ou mandar mensagem para cada pedido em aberto fora do prazo.",
    etiqueta: "Compras",
    prioridade: "MEDIA",
    recorrencia: semanal(2),
    checklist: [],
    tela: { rotulo: "Pedidos de compra", href: "/gestao-pedidos" },
  },
  {
    chave: "saude-anuncios",
    titulo: "Revisar a saúde dos anúncios",
    descricao: "Pausados, sem estoque, Full baixo e preço abaixo do custo.",
    etiqueta: "Anúncios",
    prioridade: "MEDIA",
    recorrencia: semanal(3),
    checklist: [],
    tela: { rotulo: "Saúde dos anúncios", href: "/mercado-livre" },
  },
  {
    chave: "compras-semana",
    titulo: "Revisar a sugestão de compras",
    descricao: "Gerar os pedidos de compra da semana a partir da Reposição.",
    etiqueta: "Compras",
    prioridade: "MEDIA",
    recorrencia: semanal(4),
    checklist: ["Revisar quantidades sugeridas", "Gerar os pedidos", "Mandar para os fornecedores"],
    tela: { rotulo: "Reposição", href: "/reposicao" },
  },
  {
    chave: "despesas-mes",
    titulo: "Lançar as despesas do mês",
    descricao: "Aluguel, salários, contador e ferramentas — sem isso o lucro do DRE fica maior do que é.",
    etiqueta: "Financeiro",
    prioridade: "MEDIA",
    recorrencia: mensal(3),
    checklist: [],
    tela: { rotulo: "Lançamentos", href: "/financeiro/lancamentos" },
  },
  {
    chave: "conferencia-mes",
    titulo: "Conferir o Financeiro do mês com o Mercado Livre",
    descricao: "Comparar vendas, tarifas e fretes do mês fechado com o painel do ML.",
    etiqueta: "Financeiro",
    prioridade: "MEDIA",
    recorrencia: mensal(5),
    checklist: [],
    tela: { rotulo: "Conferência", href: "/financeiro/conferencia" },
  },
  {
    chave: "contagem-estoque",
    titulo: "Contar o estoque dos produtos que mais vendem",
    descricao: "Contagem por amostragem para pegar divergência antes de virar venda sem estoque.",
    etiqueta: "Estoque",
    prioridade: "BAIXA",
    recorrencia: mensal(15),
    checklist: [],
    tela: { rotulo: "Produtos", href: "/produtos" },
  },
];

function diaDaSemana(dia: DiaCalendario): number {
  return new Date(Date.UTC(dia.ano, dia.mes - 1, dia.dia)).getUTCDay();
}

export function primeiroPrazo(recorrencia: Recorrencia, agora: Date = new Date()): string {
  const hoje = diaEmBrasilia(agora);
  if (recorrencia.frequencia === "DIARIA") return diaParaTexto(hoje);
  if (recorrencia.frequencia === "SEMANAL") {
    for (let passo = 0; passo < 7; passo += 1) {
      const dia = somarDiasAoDia(hoje, passo);
      if (recorrencia.diasSemana.includes(diaDaSemana(dia))) return diaParaTexto(dia);
    }
    return diaParaTexto(hoje);
  }
  const alvo = recorrencia.diaDoMes ?? hoje.dia;
  const mesmoMes = alvo >= hoje.dia;
  const ano = mesmoMes ? hoje.ano : hoje.mes === 12 ? hoje.ano + 1 : hoje.ano;
  const mes = mesmoMes ? hoje.mes : hoje.mes === 12 ? 1 : hoje.mes + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return diaParaTexto({ ano, mes, dia: Math.min(alvo, ultimo) });
}

export function chaveDaRotina(chave: string): string {
  return `rotina:${chave}`;
}

export async function listarRotinas(contexto: ContextoOperacao): Promise<Array<RotinaSugerida & { ativa: boolean }>> {
  const ativas = await prisma.tarefa.findMany({
    where: {
      contaId: contexto.contaId,
      chaveOrigem: { in: ROTINAS_SUGERIDAS.map((r) => chaveDaRotina(r.chave)) },
      concluidaEm: null,
      arquivadaEm: null,
    },
    select: { chaveOrigem: true },
  });
  const chaves = new Set(ativas.map((t) => t.chaveOrigem));
  return ROTINAS_SUGERIDAS.map((rotina) => ({ ...rotina, ativa: chaves.has(chaveDaRotina(rotina.chave)) }));
}

export async function criarRotinas(contexto: ContextoOperacao, chaves: string[], agora: Date = new Date()): Promise<CartaoTarefa[]> {
  exigirEdicao(contexto);
  const escolhidas = ROTINAS_SUGERIDAS.filter((r) => chaves.includes(r.chave));
  const etiquetas = await prisma.etiquetaTarefa.findMany({
    where: { contaId: contexto.contaId, nome: { in: escolhidas.map((r) => r.etiqueta) } },
    select: { id: true, nome: true },
  });
  const porNome = new Map(etiquetas.map((e) => [e.nome, e.id]));
  const criadas: CartaoTarefa[] = [];
  for (const rotina of escolhidas) {
    const etiquetaId = porNome.get(rotina.etiqueta);
    const { tarefa, existente } = await criarTarefa(
      contexto,
      {
        titulo: rotina.titulo,
        descricao: rotina.descricao,
        prioridade: rotina.prioridade,
        responsavelId: contexto.podeEditar ? contexto.userId : null,
        prazo: { data: primeiroPrazo(rotina.recorrencia, agora) },
        recorrencia: rotina.recorrencia,
        checklist: rotina.checklist,
        etiquetaIds: etiquetaId ? [etiquetaId] : [],
        chaveOrigem: chaveDaRotina(rotina.chave),
        vinculo: rotina.tela ? { tipo: "TELA", rotulo: rotina.tela.rotulo, href: rotina.tela.href } : null,
      },
      { origem: "ROTINA_SUGERIDA" }
    );
    if (!existente) criadas.push(tarefa);
  }
  return criadas;
}
