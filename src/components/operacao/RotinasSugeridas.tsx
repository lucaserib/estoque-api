"use client";

import { useEffect, useState } from "react";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { descreverRecorrencia, type Recorrencia } from "@/modules/operacao/dominio/recorrencia";
import { chamarOperacao } from "./api";
import { avisarTarefasMudaram } from "./eventos";
import { Folha } from "./Folha";

interface Rotina {
  chave: string;
  titulo: string;
  descricao: string;
  etiqueta: string;
  recorrencia: Recorrencia;
  ativa: boolean;
}

export function RotinasSugeridas({ className }: { className?: string }) {
  const [aberta, setAberta] = useState(false);
  const [rotinas, setRotinas] = useState<Rotina[] | null>(null);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    chamarOperacao<{ rotinas: Rotina[] }>("/rotinas")
      .then(({ rotinas: lista }) => {
        setRotinas(lista);
        setEscolhidas(lista.filter((r) => !r.ativa).slice(0, 4).map((r) => r.chave));
      })
      .catch(() => toast.error("Não foi possível carregar as rotinas."));
  }, [aberta]);

  const criar = async () => {
    setSalvando(true);
    try {
      const { criadas } = await chamarOperacao<{ criadas: unknown[] }>("/rotinas", { corpo: { chaves: escolhidas } });
      toast.success(criadas.length === 1 ? "1 rotina criada" : `${criadas.length} rotinas criadas`);
      avisarTarefasMudaram();
      setAberta(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar as rotinas.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Button variant="outline" className={cn("h-10 gap-2", className)} onClick={() => setAberta(true)}>
        <Repeat className="h-4 w-4" />
        Ver rotinas sugeridas
      </Button>
      <Folha
        aberta={aberta}
        aoMudar={setAberta}
        titulo="Rotinas da loja"
        descricao="Tarefas que voltam sozinhas quando você conclui"
        largura="media"
        rodape={
          <Button className="h-11 w-full gap-2" onClick={criar} disabled={salvando || escolhidas.length === 0} data-testid="criar-rotinas">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            {escolhidas.length === 0 ? "Escolha uma rotina" : `Criar ${escolhidas.length} ${escolhidas.length === 1 ? "rotina" : "rotinas"}`}
          </Button>
        }
      >
        {!rotinas ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="divide-y divide-divider">
            {rotinas.map((rotina) => {
              const marcada = escolhidas.includes(rotina.chave);
              return (
                <li key={rotina.chave}>
                  <label className={cn("flex cursor-pointer gap-3 px-4 py-3", rotina.ativa && "cursor-default opacity-60")}>
                    <input
                      type="checkbox"
                      checked={rotina.ativa || marcada}
                      disabled={rotina.ativa}
                      onChange={() => setEscolhidas((atual) => (marcada ? atual.filter((c) => c !== rotina.chave) : [...atual, rotina.chave]))}
                      className="mt-1 h-[18px] w-[18px] shrink-0 accent-[hsl(var(--primary))]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{rotina.titulo}</span>
                      <span className="block text-xs text-primary">
                        {descreverRecorrencia(rotina.recorrencia)} · {rotina.etiqueta}
                        {rotina.ativa ? " · já está na sua lista" : ""}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{rotina.descricao}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Folha>
    </>
  );
}
