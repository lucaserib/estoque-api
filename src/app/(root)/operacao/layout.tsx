"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { PageHeader } from "@/components/ui/page-header";
import { DetalheTarefa } from "@/components/operacao/DetalheTarefa";
import { abrirNovaTarefa } from "@/components/operacao/eventos";
import { NavegacaoOperacao } from "@/components/operacao/NavegacaoOperacao";
import { OperacaoProvider, useOperacao } from "@/components/operacao/OperacaoContexto";
import { useAbrirTarefa } from "@/components/operacao/useAbrirTarefa";

function NovaPelaUrl() {
  const parametros = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const pedir = parametros.get("nova") === "1" && !pathname.startsWith("/operacao/ideias");
  useEffect(() => {
    if (!pedir) return;
    abrirNovaTarefa();
    router.replace(pathname, { scroll: false });
  }, [pedir, pathname, router]);
  return null;
}

function DetalhePelaUrl() {
  const { tarefaAberta, abrir } = useAbrirTarefa();
  return <DetalheTarefa tarefaId={tarefaAberta} aoFechar={() => abrir(null)} />;
}

function Conteudo({ children }: { children: React.ReactNode }) {
  const { inicio, erro } = useOperacao();
  const pathname = usePathname();
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4">
      <PageHeader title="Operação" subtitle="Tarefas, rotinas e ideias da equipe num lugar só." className="hidden sm:flex" />
      <h1 className="text-xl font-semibold sm:hidden">Operação</h1>
      <NavegacaoOperacao />
      {erro && !inicio ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive-text">{erro}</p>
      ) : (
        children
      )}
      <Suspense fallback={null}>
        <DetalhePelaUrl />
        <NovaPelaUrl />
      </Suspense>
      {inicio?.usuario.podeEditar && !pathname.startsWith("/operacao/ideias") && (
        <FloatingActionButton label="Nova tarefa" onClick={() => abrirNovaTarefa()} />
      )}
    </div>
  );
}

export default function LayoutOperacao({ children }: { children: React.ReactNode }) {
  return (
    <OperacaoProvider>
      <Conteudo>{children}</Conteudo>
    </OperacaoProvider>
  );
}
