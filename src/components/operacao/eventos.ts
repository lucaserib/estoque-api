import type { EntradaCriarTarefa } from "@/modules/operacao/dominio/esquemas";

export const EVENTO_NOVA_TAREFA = "skubo:nova-tarefa";
export const EVENTO_TAREFAS_MUDARAM = "skubo:tarefas-mudaram";

export type DetalheNovaTarefa = Partial<
  Pick<EntradaCriarTarefa, "titulo" | "descricao" | "quadroId" | "colunaId" | "origem" | "chaveOrigem" | "vinculo" | "notaId" | "prioridade" | "responsavelId">
> & { prazoData?: string };

let pedidoPendente: DetalheNovaTarefa | null = null;
let ouvintes = 0;

export function abrirNovaTarefa(detalhe: DetalheNovaTarefa = {}) {
  if (ouvintes === 0) {
    pedidoPendente = detalhe;
    return;
  }
  window.dispatchEvent(new CustomEvent<DetalheNovaTarefa>(EVENTO_NOVA_TAREFA, { detail: detalhe }));
}

export function ouvirNovaTarefa(aoPedir: (detalhe: DetalheNovaTarefa) => void): () => void {
  const ouvinte = (evento: Event) => aoPedir((evento as CustomEvent<DetalheNovaTarefa>).detail ?? {});
  window.addEventListener(EVENTO_NOVA_TAREFA, ouvinte);
  ouvintes += 1;
  if (pedidoPendente) {
    const pendente = pedidoPendente;
    pedidoPendente = null;
    aoPedir(pendente);
  }
  return () => {
    ouvintes -= 1;
    window.removeEventListener(EVENTO_NOVA_TAREFA, ouvinte);
  };
}

export function avisarTarefasMudaram() {
  window.dispatchEvent(new CustomEvent(EVENTO_TAREFAS_MUDARAM));
}
