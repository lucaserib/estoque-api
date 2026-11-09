import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Gift, Sparkles } from "lucide-react";
import { obterConfiguracaoComercial, pacotesAtivos } from "@/modules/comercial/configuracao";
import { formatBRL } from "@/lib/format";
import { consultarConvite } from "@/modules/indicacao/convite";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Planos · Skubo",
  description: "Estoque, reposição e lucro do Mercado Livre e do Bling num lugar só. Teste grátis, sem cartão.",
};

const PARAMETROS_REPASSADOS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"];

export default async function PlanosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [configuracao, parametros] = await Promise.all([obterConfiguracaoComercial(), searchParams]);
  const convite = typeof parametros.ref === "string" ? await consultarConvite(parametros.ref) : null;
  const repassar = new URLSearchParams();
  for (const chave of PARAMETROS_REPASSADOS) {
    const valor = parametros[chave];
    if (typeof valor === "string" && valor.trim()) repassar.set(chave, valor.trim().slice(0, 120));
  }
  const destino = `/register${repassar.size ? `?${repassar.toString()}` : ""}`;
  const textos = configuracao.textosOferta;
  const primeiroMes = configuracao.precoPrimeiroMesCentavos;
  const pacotes = pacotesAtivos(configuracao);

  return (
    <div className="space-y-10">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{textos.titulo}</h1>
        <p className="mt-3 text-muted-foreground">{textos.subtitulo}</p>
        {convite?.valido && (
          <p className="mx-auto mt-5 flex max-w-xl items-start justify-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3 text-left text-sm" data-testid="banner-convite">
            <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {convite.convidadoPor ? <strong>{convite.convidadoPor}</strong> : "Uma loja parceira"} convidou você.
              {convite.bonusPerguntasIa > 0 ? ` Criando a conta, você ganha ${convite.bonusPerguntasIa} perguntas extras para a IA.` : ""}
            </span>
          </p>
        )}
      </div>

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <section className="flex flex-col rounded-card border border-border bg-card p-6" aria-labelledby="plano-mensal">
          <h2 id="plano-mensal" className="text-lg font-semibold">Mensal</h2>
          {textos.chamadaMensal && primeiroMes !== null && <p className="mt-1 text-sm text-primary">{textos.chamadaMensal}</p>}
          <p className="mt-4 text-3xl font-bold tabular-nums">
            {formatBRL(primeiroMes ?? configuracao.precoMensalCentavos)}
            <span className="text-sm font-normal text-muted-foreground">{primeiroMes !== null ? " no 1º mês" : " /mês"}</span>
          </p>
          {primeiroMes !== null && (
            <p className="text-sm text-muted-foreground">Depois {formatBRL(configuracao.precoMensalCentavos)}/mês</p>
          )}
          <Link
            href={destino}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-border font-medium hover:bg-muted"
          >
            {textos.chamadaTeste}
          </Link>
        </section>

        <section className="flex flex-col rounded-card border-2 border-primary bg-card p-6" aria-labelledby="plano-anual">
          <div className="flex items-center justify-between gap-2">
            <h2 id="plano-anual" className="text-lg font-semibold">Anual</h2>
            {textos.seloAnual && (
              <span className="rounded-full bg-primary/[0.12] px-2.5 py-1 text-xs font-medium text-primary">{textos.seloAnual}</span>
            )}
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums">
            {formatBRL(configuracao.precoAnualCentavos)}
            <span className="text-sm font-normal text-muted-foreground"> /ano</span>
          </p>
          <p className="text-sm text-muted-foreground">Equivale a {formatBRL(Math.round(configuracao.precoAnualCentavos / 12))}/mês</p>
          <Link
            href={destino}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90"
          >
            {textos.chamadaTeste}
          </Link>
        </section>
      </div>

      {textos.beneficios.length > 0 && (
        <ul className="mx-auto grid max-w-3xl gap-2 text-sm text-fg2 sm:grid-cols-2">
          {textos.beneficios.map((beneficio) => (
            <li key={beneficio} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
              {beneficio}
            </li>
          ))}
        </ul>
      )}

      {pacotes.length > 0 && (
        <section className="mx-auto max-w-3xl rounded-card border border-border bg-card p-6" aria-labelledby="skubo-ia">
          <h2 id="skubo-ia" className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            Skubo IA
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pergunte o que quiser sobre estoque, vendas e lucro da sua loja. {configuracao.iaPerguntasTeste} perguntas grátis no teste; depois,
            pacotes avulsos, sem mensalidade.
          </p>
          <ul className="mt-4 flex flex-wrap gap-3">
            {pacotes.map((pacote) => (
              <li key={pacote.id} className="rounded-lg border border-border px-4 py-3 text-sm">
                <span className="font-semibold">{pacote.nome}</span> · {formatBRL(pacote.precoCentavos)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
