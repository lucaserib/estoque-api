"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2, CircleDashed, Inbox, Sparkles, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import type { CartaoTarefa, PaginaTarefas, ResumoOperacao } from "@/modules/operacao/tipos";
import { chamarOperacao, parametros } from "@/components/operacao/api";
import { CapturaRapida } from "@/components/operacao/CapturaRapida";
import { EVENTO_TAREFAS_MUDARAM } from "@/components/operacao/eventos";
import { ListaDeTarefas } from "@/components/operacao/ListaDeTarefas";
import { useOperacao } from "@/components/operacao/OperacaoContexto";
import { AvatarPessoa } from "@/components/operacao/Pecas";
import { RotinasSugeridas } from "@/components/operacao/RotinasSugeridas";
import { useAbrirTarefa } from "@/components/operacao/useAbrirTarefa";

type Secao = "atrasadas" | "hoje" | "semana" | "sem-prazo";

const SECOES: Array<{ chave: Secao; titulo: string; icone: typeof Inbox; tom: string; vazio: string }> = [
  { chave: "atrasadas", titulo: "Atrasadas", icone: AlertTriangle, tom: "text-destructive-text", vazio: "Nada atrasado. Boa!" },
  { chave: "hoje", titulo: "Para hoje", icone: CalendarClock, tom: "text-warning-text", vazio: "Nada vence hoje." },
  { chave: "semana", titulo: "Próximos 7 dias", icone: CalendarRange, tom: "text-primary", vazio: "Nada nos próximos dias." },
  { chave: "sem-prazo", titulo: "Sem prazo", icone: CircleDashed, tom: "text-muted-foreground", vazio: "Tudo o que é seu tem prazo." },
];

function saudacao(agora: Date): string {
  const hora = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(agora));
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function Contador({ rotulo, valor, tom, icone: Icone, href }: { rotulo: string; valor: number; tom: string; icone: typeof Inbox; href: string }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-card border border-border/80 bg-card p-3 shadow-card hover:border-primary/40">
      <Icone className={cn("h-5 w-5 shrink-0", tom)} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums leading-none text-foreground">{valor}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </a>
  );
}

function MeuDia() {
  const { inicio } = useOperacao();
  const { abrir } = useAbrirTarefa();
  const [resumo, setResumo] = useState<ResumoOperacao | null>(null);
  const [listas, setListas] = useState<Record<Secao, CartaoTarefa[]> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [novoResumo, ...paginas] = await Promise.all([
        chamarOperacao<ResumoOperacao>("/resumo"),
        ...SECOES.map((secao) =>
          chamarOperacao<PaginaTarefas>(`/tarefas${parametros({ escopo: "minhas", situacao: secao.chave, ordem: "prazo", porPagina: 50 })}`)
        ),
      ]);
      setResumo(novoResumo as ResumoOperacao);
      setListas(
        Object.fromEntries(SECOES.map((secao, indice) => [secao.chave, (paginas[indice] as PaginaTarefas).itens])) as Record<Secao, CartaoTarefa[]>
      );
    } catch {
      setListas((atual) => atual ?? { atrasadas: [], hoje: [], semana: [], "sem-prazo": [] });
    }
  }, []);

  useEffect(() => {
    carregar();
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
    window.addEventListener("focus", carregar);
    return () => {
      window.removeEventListener(EVENTO_TAREFAS_MUDARAM, carregar);
      window.removeEventListener("focus", carregar);
    };
  }, [carregar]);

  const removerOtimista = (id: string) =>
    setListas((atual) =>
      atual ? (Object.fromEntries(Object.entries(atual).map(([k, v]) => [k, v.filter((t) => t.id !== id)])) as Record<Secao, CartaoTarefa[]>) : atual
    );

  if (!inicio) return <Skeleton className="h-64 w-full" />;
  const primeiroNome = inicio.usuario.nome.split(" ")[0];
  const totalAbertas = listas ? Object.values(listas).reduce((soma, lista) => soma + lista.length, 0) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <div>
          <p className="text-lg font-semibold text-foreground">
            {saudacao(new Date())}, {primeiroNome}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date())}
          </p>
        </div>

        <CapturaRapida responsavelPadrao={inicio.usuario.podeEditar ? inicio.usuario.id : null} />

        {resumo && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="contadores-meu-dia">
            <Contador rotulo="Atrasadas" valor={resumo.minhas.atrasadas} tom="text-destructive-text" icone={AlertTriangle} href="#atrasadas" />
            <Contador rotulo="Para hoje" valor={resumo.minhas.hoje} tom="text-warning-text" icone={CalendarClock} href="#hoje" />
            <Contador rotulo="Próximos 7 dias" valor={resumo.minhas.proximos7Dias} tom="text-primary" icone={CalendarRange} href="#semana" />
            <Contador rotulo="Feitas na semana" valor={resumo.minhas.concluidasSemana} tom="text-success-text" icone={CheckCircle2} href="/operacao/lista" />
          </div>
        )}

        {!listas && <Skeleton className="h-40 w-full" />}
        {listas && totalAbertas === 0 && (
          <div className="rounded-card border border-dashed border-border p-6 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-2 font-semibold text-foreground">Nada com você agora</p>
            <p className="mt-1 text-sm text-muted-foreground">Anote acima o que precisa ser feito ou comece com as rotinas que toda loja tem.</p>
            {inicio.usuario.podeEditar && <RotinasSugeridas className="mt-4" />}
          </div>
        )}
        {listas &&
          SECOES.filter((secao) => listas[secao.chave].length > 0).map((secao) => {
            const Icone = secao.icone;
            return (
              <section key={secao.chave} id={secao.chave} className="scroll-mt-20 space-y-2" aria-label={secao.titulo}>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icone className={cn("h-4 w-4", secao.tom)} aria-hidden="true" />
                  {secao.titulo}
                  <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-fg2">{listas[secao.chave].length}</span>
                </h2>
                <ListaDeTarefas tarefas={listas[secao.chave]} aoAbrir={abrir} aoMudar={carregar} aoRemoverOtimista={removerOtimista} mostrarQuadro />
              </section>
            );
          })}
      </div>

      <aside className="space-y-4">
        {resumo && resumo.semResponsavel > 0 && (
          <Link
            href="/operacao/lista?responsavel=ninguem"
            className="flex items-center gap-3 rounded-card border border-warning/30 bg-warning/[0.06] p-3 text-sm hover:border-warning/60"
          >
            <Inbox className="h-5 w-5 shrink-0 text-warning-text" />
            <span>
              <strong>{resumo.semResponsavel}</strong> {resumo.semResponsavel === 1 ? "tarefa está" : "tarefas estão"} sem responsável.
            </span>
          </Link>
        )}
        {resumo?.equipe && (
          <SectionCard title="Equipe" contentClassName="p-0">
            <ul className="divide-y divide-divider" data-testid="painel-equipe">
              {resumo.equipe.map((pessoa) => (
                <li key={pessoa.id}>
                  <Link href={`/operacao/lista?responsavel=${pessoa.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <AvatarPessoa pessoa={pessoa} tamanho={28} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{pessoa.nome}</span>
                    <span className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-fg2" title="Abertas">
                        {pessoa.abertas}
                      </span>
                      {pessoa.atrasadas > 0 && (
                        <span className="rounded-full bg-destructive/10 px-1.5 font-semibold text-destructive-text" title="Atrasadas">
                          {pessoa.atrasadas}
                        </span>
                      )}
                      <span className="text-success-text" title="Concluídas em 7 dias">
                        ✓{pessoa.concluidasSemana}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-1.5 border-t border-divider px-4 py-2 text-[11px] text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              abertas · atrasadas · feitas em 7 dias
            </p>
          </SectionCard>
        )}
        {inicio.usuario.podeEditar && listas && totalAbertas > 0 && (
          <SectionCard title="Rotinas da loja">
            <p className="mb-3 text-sm text-muted-foreground">Tarefas que se repetem sozinhas: Full, perguntas do ML, conferência do mês…</p>
            <RotinasSugeridas />
          </SectionCard>
        )}
      </aside>
    </div>
  );
}

export default function MeuDiaPage() {
  return (
    <Suspense fallback={null}>
      <MeuDia />
    </Suspense>
  );
}
