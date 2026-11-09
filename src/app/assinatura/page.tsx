"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { BellRing, CheckCircle2, Loader2, LogOut, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/Logo";
import { formatBRL, formatDateBR } from "@/lib/format";
import { CartaoCreditosIa } from "@/components/ia/CartaoCreditosIa";
import { CartaoPedirIndicacao } from "@/components/indicacao/CartaoPedirIndicacao";

type StatusConta = "TESTE" | "ATIVA" | "INADIMPLENTE" | "VENCIDA" | "CANCELADA" | "BLOQUEADA";

interface StatusAssinatura {
  plan: "MONTHLY" | "ANNUAL" | null;
  active: boolean;
  paymentsConfigured: boolean;
  podeGerenciar: boolean;
  nomeLoja: string | null;
  situacao: {
    status: StatusConta;
    podeUsar: boolean;
    testeTerminaEm: string | null;
    diasRestantesTeste: number | null;
    periodoTerminaEm: string | null;
    donoNome: string | null;
  };
}

interface Planos {
  diasTeste: number;
  precos: { mensalCentavos: number; primeiroMesCentavos: number | null; anualCentavos: number };
  textos: { titulo: string; subtitulo: string; beneficios: string[]; seloAnual: string; chamadaMensal: string };
}

type Plano = "MONTHLY" | "ANNUAL";

function AvisoDaSituacao({
  status,
  onCancelar,
  cancelando,
}: {
  status: StatusAssinatura;
  onCancelar: () => void;
  cancelando: boolean;
}) {
  const { situacao } = status;
  if (situacao.status === "TESTE" && situacao.testeTerminaEm) {
    return (
      <Card className="border-info bg-info/5">
        <CardContent className="p-4 text-sm">
          Seu teste grátis termina em {formatDateBR(situacao.testeTerminaEm)}
          {situacao.diasRestantesTeste !== null && ` (${situacao.diasRestantesTeste} ${situacao.diasRestantesTeste === 1 ? "dia" : "dias"})`}.
          Se assinar agora, a primeira cobrança só acontece no fim do teste.
        </CardContent>
      </Card>
    );
  }
  if (situacao.status === "ATIVA") {
    return (
      <Card className="border-success bg-success/5">
        <CardContent className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            Assinatura ativa
            {situacao.periodoTerminaEm && ` · renova em ${formatDateBR(situacao.periodoTerminaEm)}`}
          </span>
          {status.podeGerenciar && (
            <Button variant="outline" size="sm" onClick={onCancelar} disabled={cancelando}>
              {cancelando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar assinatura"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  if (situacao.status === "INADIMPLENTE") {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="p-4 text-sm">
          Não conseguimos confirmar o último pagamento. Atualize o cartão no Mercado Pago ou escolha um plano abaixo para
          continuar.
        </CardContent>
      </Card>
    );
  }
  if (situacao.status === "CANCELADA") {
    return (
      <Card className="border-warning bg-warning/5">
        <CardContent className="p-4 text-sm">
          Assinatura cancelada
          {situacao.podeUsar && situacao.periodoTerminaEm
            ? `. Você usa até ${formatDateBR(situacao.periodoTerminaEm)}.`
            : ". Escolha um plano para voltar."}
        </CardContent>
      </Card>
    );
  }
  if (situacao.status === "BLOQUEADA") {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="p-4 text-sm">O acesso desta conta está bloqueado. Fale com o suporte.</CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-warning bg-warning/5">
      <CardContent className="p-4 text-sm">Seu teste grátis terminou. Escolha um plano para continuar usando o Skubo.</CardContent>
    </Card>
  );
}

function VisaoDoMembro({ status }: { status: StatusAssinatura }) {
  const [enviando, setEnviando] = useState(false);
  const loja = status.nomeLoja ? `da loja ${status.nomeLoja}` : "da loja";
  const responsavel = status.situacao.donoNome ?? "o administrador da conta";

  const avisar = async () => {
    setEnviando(true);
    try {
      const resposta = await fetch("/api/assinatura/avisar-responsavel", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (resposta.ok) toast.success("Avisamos o responsável pela assinatura.");
      else toast.error(corpo?.error ?? "Não foi possível avisar agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <p className="text-base font-medium">
          A assinatura {loja} {status.situacao.status === "BLOQUEADA" ? "está bloqueada" : "venceu"}.
        </p>
        <p className="text-sm text-muted-foreground">Só {responsavel} pode renovar. Quer que a gente avise?</p>
        <Button onClick={avisar} disabled={enviando} className="w-full gap-2 sm:w-auto">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Avisar o responsável
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AssinaturaPage() {
  const { status: sessionStatus } = useSession();
  const [status, setStatus] = useState<StatusAssinatura | null>(null);
  const [planos, setPlanos] = useState<Planos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [redirecionando, setRedirecionando] = useState<Plano | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [cupom, setCupom] = useState("");
  const [mostrarCupom, setMostrarCupom] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [respostaStatus, respostaPlanos] = await Promise.all([fetch("/api/mercadopago/status"), fetch("/api/planos")]);
      if (respostaStatus.ok) setStatus(await respostaStatus.json());
      if (respostaPlanos.ok) setPlanos(await respostaPlanos.json());
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") carregar();
  }, [sessionStatus, carregar]);

  const cancelar = async () => {
    if (!window.confirm("Cancelar sua assinatura? Você continua usando até o fim do período já pago.")) return;
    setCancelando(true);
    try {
      const resposta = await fetch("/api/mercadopago/cancel", { method: "POST" });
      if (!resposta.ok) throw new Error();
      toast.success("Assinatura cancelada.");
      await carregar();
    } catch {
      toast.error("Não foi possível cancelar agora.");
    } finally {
      setCancelando(false);
    }
  };

  const assinar = async (plano: Plano) => {
    setRedirecionando(plano);
    try {
      const resposta = await fetch("/api/mercadopago/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plano, cupom: cupom.trim() || null }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok || !corpo?.checkoutUrl) throw new Error(corpo?.error ?? "Erro ao iniciar a assinatura");
      window.location.href = corpo.checkoutUrl;
    } catch (error) {
      setRedirecionando(null);
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar a assinatura");
    }
  };

  if (carregando || sessionStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const podeAssinar = Boolean(status?.podeGerenciar && status.paymentsConfigured && status.situacao.status !== "BLOQUEADA");
  const assinaturaAtiva = status?.situacao.status === "ATIVA";
  const primeiroMes = planos?.precos.primeiroMesCentavos ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Logo size="sm" />
          <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-semibold">{planos?.textos.titulo ?? "Assinatura"}</h1>
          <p className="text-muted-foreground">{planos?.textos.subtitulo ?? "Escolha um plano para continuar usando o Skubo."}</p>
        </div>

        {status && !status.podeGerenciar && !status.situacao.podeUsar ? (
          <VisaoDoMembro status={status} />
        ) : (
          <>
            {status && <AvisoDaSituacao status={status} onCancelar={cancelar} cancelando={cancelando} />}
            {assinaturaAtiva && <CartaoPedirIndicacao forcar />}

            {status && !status.paymentsConfigured && (
              <Card className="border-warning bg-warning/5">
                <CardContent className="p-4 text-sm">
                  Os pagamentos ainda não estão ativos. Enquanto isso, o Skubo segue liberado para a sua loja.
                </CardContent>
              </Card>
            )}

            {status && !status.podeGerenciar && (
              <p className="text-sm text-muted-foreground">Só quem administra a conta pode assinar ou cancelar.</p>
            )}

            {planos && !assinaturaAtiva && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Mensal
                        {status?.plan === "MONTHLY" && status.active && <Badge>Atual</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-3xl font-bold tabular-nums">
                          {formatBRL(primeiroMes ?? planos.precos.mensalCentavos)}
                          <span className="text-sm font-normal text-muted-foreground">
                            {primeiroMes !== null ? " no primeiro mês" : " /mês"}
                          </span>
                        </p>
                        {primeiroMes !== null && (
                          <p className="text-sm text-muted-foreground">Depois {formatBRL(planos.precos.mensalCentavos)}/mês</p>
                        )}
                      </div>
                      <Button className="w-full" disabled={!podeAssinar || redirecionando !== null} onClick={() => assinar("MONTHLY")}>
                        {redirecionando === "MONTHLY" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar mensal"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2">
                        Anual
                        {planos.textos.seloAnual && <Badge>{planos.textos.seloAnual}</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-3xl font-bold tabular-nums">
                          {formatBRL(planos.precos.anualCentavos)}
                          <span className="text-sm font-normal text-muted-foreground"> /ano</span>
                        </p>
                        <p className="flex items-center gap-1 text-sm text-success-text">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Equivale a {formatBRL(Math.round(planos.precos.anualCentavos / 12))}/mês
                        </p>
                      </div>
                      <Button className="w-full" disabled={!podeAssinar || redirecionando !== null} onClick={() => assinar("ANNUAL")}>
                        {redirecionando === "ANNUAL" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar anual"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {podeAssinar && (
                  <div className="space-y-2">
                    {mostrarCupom ? (
                      <div className="flex max-w-sm gap-2">
                        <Input
                          value={cupom}
                          onChange={(evento) => setCupom(evento.target.value.toUpperCase())}
                          placeholder="CÓDIGO DO CUPOM"
                          aria-label="Código do cupom"
                          maxLength={40}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMostrarCupom(true)}
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <TicketPercent className="h-4 w-4" />
                        Tenho um cupom
                      </button>
                    )}
                    {mostrarCupom && <p className="text-xs text-muted-foreground">O desconto vale para a primeira cobrança.</p>}
                  </div>
                )}

                {planos.textos.beneficios.length > 0 && (
                  <ul className="grid gap-2 text-sm text-fg2 sm:grid-cols-2">
                    {planos.textos.beneficios.map((beneficio) => (
                      <li key={beneficio} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
                        {beneficio}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <CartaoCreditosIa />
          </>
        )}
      </div>
    </div>
  );
}
