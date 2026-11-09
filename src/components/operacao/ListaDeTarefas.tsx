"use client";

import { toast } from "sonner";
import type { CartaoTarefa } from "@/modules/operacao/tipos";
import { chamarOperacao } from "./api";
import { CartaoTarefaView } from "./CartaoTarefaView";
import { avisarTarefasMudaram } from "./eventos";
import { useOperacao } from "./OperacaoContexto";

export function useConcluirTarefa(aoMudar: () => void) {
  return async (tarefa: CartaoTarefa, concluir: boolean, aoOtimista?: () => void) => {
    aoOtimista?.();
    try {
      const resposta = await chamarOperacao<{ tarefa: CartaoTarefa; proxima: CartaoTarefa | null }>(`/tarefas/${tarefa.id}/acoes`, {
        corpo: { acao: concluir ? "concluir" : "reabrir" },
      });
      avisarTarefasMudaram();
      if (concluir) {
        toast.success(resposta.proxima ? `Concluída. A próxima da rotina (#${resposta.proxima.numero}) já está na fila.` : "Tarefa concluída", {
          action: {
            label: "Desfazer",
            onClick: async () => {
              await chamarOperacao(`/tarefas/${tarefa.id}/acoes`, { corpo: { acao: "reabrir" } }).catch(() => undefined);
              avisarTarefasMudaram();
              aoMudar();
            },
          },
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a tarefa.");
    } finally {
      aoMudar();
    }
  };
}

export function ListaDeTarefas({
  tarefas,
  aoAbrir,
  aoMudar,
  aoRemoverOtimista,
  mostrarQuadro = false,
  vazio,
}: {
  tarefas: CartaoTarefa[];
  aoAbrir: (id: string) => void;
  aoMudar: () => void;
  aoRemoverOtimista?: (id: string) => void;
  mostrarQuadro?: boolean;
  vazio?: React.ReactNode;
}) {
  const { inicio } = useOperacao();
  const concluir = useConcluirTarefa(aoMudar);
  const nomeDoQuadro = (id: string) => (mostrarQuadro && (inicio?.quadros.length ?? 0) > 1 ? inicio?.quadros.find((q) => q.id === id)?.nome ?? null : null);

  if (tarefas.length === 0) return <>{vazio ?? null}</>;
  return (
    <ul className="space-y-2">
      {tarefas.map((tarefa) => (
        <li key={tarefa.id}>
          <CartaoTarefaView
            tarefa={tarefa}
            aoAbrir={aoAbrir}
            podeEditar={Boolean(inicio?.usuario.podeEditar) && !tarefa.arquivadaEm}
            aoConcluir={(t, valor) => concluir(t, valor, () => aoRemoverOtimista?.(t.id))}
            mostrarQuadro={nomeDoQuadro(tarefa.quadroId)}
          />
        </li>
      ))}
    </ul>
  );
}
