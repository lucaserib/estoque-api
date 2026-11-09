import { definirModelo, saudacao } from "./tipos";

export function textoLivreSeguro(texto: string, limite = 200): string {
  const limpo = texto
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "*")
    .replace(/\]\(/g, "] (")
    .replace(/\[\[/g, "[ [")
    .replace(/^#+\s*/, "")
    .trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo;
}

const MOTIVO =
  "Você recebe este e-mail porque faz parte da equipe da loja no Skubo. Para não receber avisos de tarefas por e-mail, desligue em Perfil → Notificações.";

export type DadosTarefaAtribuida = { nome: string | null; autor: string; numero: number; titulo: string; prazo: string | null; link: string };

export const tarefaAtribuida = definirModelo<DadosTarefaAtribuida>({
  chave: "tarefa-atribuida",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: `Nova tarefa para você: #${dados.numero} ${textoLivreSeguro(dados.titulo, 60)}`,
    preCabecalho: `${textoLivreSeguro(dados.autor, 60)} passou uma tarefa para você${dados.prazo ? ` com prazo ${dados.prazo}` : ""}.`,
    corpo: `${saudacao(dados.nome)}\n\n**${textoLivreSeguro(dados.autor, 60)}** passou uma tarefa para você no Skubo:\n\n**#${dados.numero} · ${textoLivreSeguro(dados.titulo)}**${dados.prazo ? `\n\nPrazo: **${dados.prazo}**` : ""}`,
    botao: { rotulo: "Abrir a tarefa", url: dados.link },
    motivo: MOTIVO,
  }),
});

export type DadosTarefaMencao = { nome: string | null; autor: string; numero: number; titulo: string; trecho: string; link: string };

export const tarefaMencao = definirModelo<DadosTarefaMencao>({
  chave: "tarefa-mencao",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => ({
    assunto: `${textoLivreSeguro(dados.autor, 60)} mencionou você na tarefa #${dados.numero}`,
    preCabecalho: textoLivreSeguro(dados.trecho, 120),
    corpo: `${saudacao(dados.nome)}\n\n**${textoLivreSeguro(dados.autor, 60)}** mencionou você em **#${dados.numero} · ${textoLivreSeguro(dados.titulo)}**:\n\n> ${textoLivreSeguro(dados.trecho, 400)}`,
    botao: { rotulo: "Responder", url: dados.link },
    motivo: MOTIVO,
  }),
});

export type ItemResumoTarefa = { numero: number; titulo: string; prazo: string };
export type DadosResumoTarefas = {
  nome: string | null;
  atrasadas: ItemResumoTarefa[];
  hoje: ItemResumoTarefa[];
  totalAtrasadas: number;
  totalHoje: number;
  link: string;
};

function lista(itens: ItemResumoTarefa[], total: number): string {
  const linhas = itens.map((item) => `- #${item.numero} · ${textoLivreSeguro(item.titulo, 90)} (${item.prazo})`);
  if (total > itens.length) linhas.push(`- e mais ${total - itens.length}`);
  return linhas.join("\n");
}

export const resumoTarefas = definirModelo<DadosResumoTarefas>({
  chave: "resumo-tarefas",
  categoria: "TRANSACIONAL",
  urgente: false,
  montar: (dados) => {
    const partes: string[] = [];
    if (dados.totalAtrasadas > 0) partes.push(`${dados.totalAtrasadas} ${dados.totalAtrasadas === 1 ? "atrasada" : "atrasadas"}`);
    if (dados.totalHoje > 0) partes.push(`${dados.totalHoje} para hoje`);
    const blocos = [saudacao(dados.nome), `Seu dia no Skubo: ${partes.join(" e ")}.`];
    if (dados.atrasadas.length > 0) blocos.push("## Atrasadas", lista(dados.atrasadas, dados.totalAtrasadas));
    if (dados.hoje.length > 0) blocos.push("## Para hoje", lista(dados.hoje, dados.totalHoje));
    return {
      assunto: `Seu dia: ${partes.join(" e ")}`,
      preCabecalho: "O que está com você na operação da loja hoje.",
      corpo: blocos.join("\n\n"),
      botao: { rotulo: "Abrir meu dia", url: dados.link },
      motivo: MOTIVO,
    };
  },
});
