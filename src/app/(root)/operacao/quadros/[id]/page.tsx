"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FILTROS_VAZIOS, FiltrosTarefas, type ValorFiltros } from "@/components/operacao/FiltrosTarefas";
import { GerenciarQuadro, NovoQuadro } from "@/components/operacao/GerenciarQuadro";
import { abrirNovaTarefa } from "@/components/operacao/eventos";
import { useOperacao } from "@/components/operacao/OperacaoContexto";
import { QuadroKanban } from "@/components/operacao/QuadroKanban";
import { useAbrirTarefa } from "@/components/operacao/useAbrirTarefa";

function Quadro() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { inicio, quadroPadrao } = useOperacao();
  const { abrir } = useAbrirTarefa();
  const [filtros, setFiltros] = useState<ValorFiltros>(FILTROS_VAZIOS);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const [criandoQuadro, setCriandoQuadro] = useState(false);

  if (!inicio) return null;
  const quadro = inicio.quadros.find((q) => q.id === id);
  if (!quadro) {
    return (
      <p className="rounded-xl border border-border p-4 text-sm text-fg2">
        Esse quadro não existe mais ou foi arquivado.{" "}
        {quadroPadrao && (
          <Link href={`/operacao/quadros/${quadroPadrao.id}`} className="font-medium text-primary hover:underline">
            Abrir {quadroPadrao.nome}
          </Link>
        )}
      </p>
    );
  }

  const podeAdministrar = inicio.usuario.podeAdministrar;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={quadro.id}
          onChange={(e) => (e.target.value === "__novo" ? setCriandoQuadro(true) : router.push(`/operacao/quadros/${e.target.value}`))}
          aria-label="Quadro"
          className="h-10 min-w-0 max-w-full flex-1 rounded-lg border border-input bg-card px-3 text-sm font-semibold sm:h-9 sm:flex-none"
        >
          {inicio.quadros.map((q) => (
            <option key={q.id} value={q.id}>
              {q.nome}
            </option>
          ))}
          {podeAdministrar && <option value="__novo">+ Novo quadro…</option>}
        </select>
        {podeAdministrar && (
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 sm:h-9 sm:w-9" onClick={() => setConfigurando(true)} aria-label="Configurar quadro">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
        {inicio.usuario.podeEditar && (
          <Button className="hidden h-9 gap-1.5 md:inline-flex" onClick={() => abrirNovaTarefa({ quadroId: quadro.id })}>
            <Plus className="h-4 w-4" />
            Nova tarefa
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FiltrosTarefas
          valor={filtros}
          aoMudar={setFiltros}
          extras={
            <label className="flex h-10 items-center gap-2 text-sm text-fg2 sm:h-9">
              <Switch checked={mostrarConcluidas} onCheckedChange={setMostrarConcluidas} aria-label="Mostrar concluídas antigas" />
              Concluídas antigas
            </label>
          }
        />
      </div>
      <QuadroKanban quadroId={quadro.id} filtros={filtros} mostrarConcluidas={mostrarConcluidas} aoAbrir={abrir} />
      {podeAdministrar && <GerenciarQuadro key={quadro.id} quadro={quadro} aberto={configurando} aoMudar={setConfigurando} />}
      {podeAdministrar && <NovoQuadro aberto={criandoQuadro} aoMudar={setCriandoQuadro} aoCriar={(novo) => router.push(`/operacao/quadros/${novo.id}`)} />}
    </div>
  );
}

export default function QuadroPage() {
  return (
    <Suspense fallback={null}>
      <Quadro />
    </Suspense>
  );
}
