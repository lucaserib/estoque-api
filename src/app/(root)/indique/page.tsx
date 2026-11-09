"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Gift, Loader2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, formatDateBR } from "@/lib/format";

interface Painel {
  codigo: string;
  link: string;
  emailVerificado: boolean;
  regras: { ativo: boolean; diasRecompensa: number; carenciaDias: number; bonusPerguntasIa: number; exigeMlConectado: boolean };
  semanasGanhas: number;
  diasPendentes: number;
  proximaCobranca: { data: string; precoCentavos: number; descontoCentavos: number } | null;
  podeInformarCodigo: boolean;
  indicacoes: Array<{
    id: string;
    nome: string;
    status: string;
    rotuloStatus: string;
    motivo: string | null;
    proximoPasso: string | null;
    carenciaAte: string | null;
    createdAt: string;
  }>;
}

const TOM: Record<string, "success" | "warning" | "info" | "critical" | "neutral" | "primary"> = {
  CADASTRADO: "neutral",
  ATIVADO: "info",
  PAGOU: "info",
  EM_CARENCIA: "warning",
  RECOMPENSADA: "success",
  INVALIDADA: "critical",
};

function CartaoInformarCodigo({ aoInformar }: { aoInformar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    try {
      const resposta = await fetch("/api/indicacao/codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível registrar o código.");
      toast.success(
        corpo?.bonusPerguntasIa > 0
          ? `Pronto! Você ganhou ${corpo.bonusPerguntasIa} perguntas extras para a IA.`
          : "Pronto! A indicação foi registrada."
      );
      aoInformar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o código.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SectionCard title="Foi indicado por alguém?">
      <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row" data-testid="informar-codigo">
        <Input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="SKU-XXXX"
          maxLength={20}
          aria-label="Código de indicação"
          autoCapitalize="characters"
          className="h-11 sm:max-w-[220px]"
        />
        <Button type="submit" disabled={enviando || codigo.trim().length < 5} className="h-11 gap-2">
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          Usar código
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">Vale nos primeiros dias da conta, antes do primeiro pagamento. Quem indicou ganha quando você assinar.</p>
    </SectionCard>
  );
}

function mensagemPadrao(link: string, bonus: number) {
  return `Uso o Skubo pra controlar estoque, Full e lucro do Mercado Livre. Com meu link você ganha ${bonus} perguntas extras pra IA: ${link}`;
}

export default function IndiquePage() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    setPodeCompartilhar(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    fetch("/api/indicacao")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados: Painel | null) => {
        if (!dados) return;
        setPainel(dados);
        setMensagem((atual) => atual || mensagemPadrao(dados.link, dados.regras.bonusPerguntasIa));
      })
      .catch(() => toast.error("Não foi possível carregar suas indicações."));
  }, [versao]);

  const compartilhar = async () => {
    try {
      await navigator.share({ title: "Skubo", text: mensagem });
    } catch {}
  };

  const linkWhatsapp = useMemo(() => `https://wa.me/?text=${encodeURIComponent(mensagem)}`, [mensagem]);

  const copiar = async () => {
    if (!painel) return;
    await navigator.clipboard.writeText(painel.link);
    setCopiado(true);
    toast.success("Link copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  const reenviarConfirmacao = async () => {
    setReenviando(true);
    try {
      const resposta = await fetch("/api/auth/email/reenviar", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error);
      toast.success(corpo?.mensagem ?? "Mandamos um novo link de confirmação.");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível reenviar agora.");
    } finally {
      setReenviando(false);
    }
  };

  if (!painel) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-6">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const { regras } = painel;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
      <PageHeader
        eyebrow="Indique e ganhe"
        title={`Ganhe ${regras.diasRecompensa} dias grátis por indicação`}
        subtitle={`Cada loja que entrar pelo seu link e pagar a assinatura vale ${regras.diasRecompensa} dias de Skubo para você. Quem entra ganha ${regras.bonusPerguntasIa} perguntas extras para a IA.`}
      />

      {!regras.ativo && (
        <div className="rounded-card border border-warning/30 bg-warning/[0.06] p-4 text-sm">O programa de indicação está pausado no momento.</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Seu link">
          {painel.emailVerificado ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2">
                <code className="min-w-0 flex-1 truncate text-sm text-foreground" data-testid="link-indicacao">
                  {painel.link}
                </code>
                <Button size="sm" variant="ghost" onClick={copiar} aria-label="Copiar link" className="h-10 w-10 shrink-0 p-0 sm:h-8 sm:w-8">
                  {copiado ? <Check className="h-4 w-4 text-success-text" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Mensagem para o WhatsApp</span>
                <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} maxLength={600} />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="h-11 w-full gap-2 sm:w-auto">
                  <a href={linkWhatsapp} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    Enviar no WhatsApp
                  </a>
                </Button>
                {podeCompartilhar && (
                  <Button type="button" variant="outline" onClick={compartilhar} className="h-11 w-full gap-2 sm:w-auto">
                    <Share2 className="h-4 w-4" />
                    Compartilhar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Seu código: <strong className="text-foreground">{painel.codigo}</strong> · A recompensa sai {regras.carenciaDias} dias depois
                do primeiro pagamento{regras.exigeMlConectado ? ", com o Mercado Livre da loja indicada conectado" : ""}.{" "}
                <Link href="/indique/regulamento" className="text-primary hover:underline" target="_blank">
                  Ver o regulamento
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Confirme seu e-mail para liberar o seu link de indicação.</p>
              <Button variant="outline" onClick={reenviarConfirmacao} disabled={reenviando} className="gap-2">
                {reenviando && <Loader2 className="h-4 w-4 animate-spin" />}
                Reenviar e-mail de confirmação
              </Button>
            </div>
          )}
        </SectionCard>

        <SectionCard title="O que você já ganhou">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/[0.12] text-success-text">
                <Gift className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-semibold tabular-nums" data-testid="semanas-ganhas">
                  {painel.semanasGanhas} {painel.semanasGanhas === 1 ? "semana" : "semanas"}
                </p>
                <p className="text-xs text-muted-foreground">ganhas com indicações</p>
              </div>
            </div>
            {painel.proximaCobranca && (
              <p className="text-sm text-fg2">
                Próxima cobrança em {formatDateBR(painel.proximaCobranca.data)}:{" "}
                {painel.proximaCobranca.descontoCentavos > 0 ? (
                  <>
                    <span className="line-through">{formatBRL(painel.proximaCobranca.precoCentavos)}</span>{" "}
                    <strong className="text-foreground">
                      {formatBRL(Math.max(0, painel.proximaCobranca.precoCentavos - painel.proximaCobranca.descontoCentavos))}
                    </strong>
                  </>
                ) : (
                  <strong className="text-foreground">{formatBRL(painel.proximaCobranca.precoCentavos)}</strong>
                )}
              </p>
            )}
            {painel.diasPendentes > 0 && (
              <p className="text-sm text-fg2">
                {painel.diasPendentes} {painel.diasPendentes === 1 ? "dia guardado" : "dias guardados"} para a próxima cobrança.
              </p>
            )}
          </div>
        </SectionCard>
      </div>

      {painel.podeInformarCodigo && <CartaoInformarCodigo aoInformar={() => setVersao((v) => v + 1)} />}

      <SectionCard title="Suas indicações" contentClassName="p-0">
        {painel.indicacoes.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Ninguém entrou pelo seu link ainda. Que tal mandar para um amigo que vende no Mercado Livre?</p>
        ) : (
          <ul className="divide-y divide-divider">
            {painel.indicacoes.map((indicacao) => (
              <li key={indicacao.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{indicacao.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Entrou em {formatDateBR(indicacao.createdAt)}
                    {indicacao.status === "EM_CARENCIA" && indicacao.carenciaAte && ` · recompensa a partir de ${formatDateBR(indicacao.carenciaAte)}`}
                  </p>
                  {indicacao.proximoPasso && <p className="text-xs text-fg2">{indicacao.proximoPasso}</p>}
                  {indicacao.motivo && <p className="text-xs text-destructive-text">{indicacao.motivo}</p>}
                </div>
                <StatusPill tone={TOM[indicacao.status] ?? "neutral"} className="self-start sm:self-auto">
                  {indicacao.rotuloStatus}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
