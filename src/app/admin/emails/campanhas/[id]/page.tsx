"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DialogoAcaoAdmin, PainelAdmin, chamarAdmin } from "@/components/admin/ui";
import { PreviaEmail } from "@/components/admin/PreviaEmail";
import { formatNumberBR } from "@/lib/format";

interface Segmento {
  situacoes?: string[];
  planos?: string[];
  diasDesdeCadastroMin?: number;
  diasDesdeCadastroMax?: number;
  mlConectado?: boolean;
  blingConectado?: boolean;
  comprouCreditos?: boolean;
  saldoIaMin?: number;
  saldoIaMax?: number;
  utmSource?: string;
  comoConheceu?: string[];
  faixas?: string[];
  canais?: string[];
}

interface Campanha {
  id?: string;
  nome: string;
  assunto: string;
  preCabecalho: string;
  corpoMarkdown: string;
  rotuloBotao: string | null;
  urlBotao: string | null;
  segmento: Segmento;
  categoria: "MARKETING" | "CICLO_DE_VIDA";
  status?: string;
  metricas?: Record<string, number>;
}

const VAZIA: Campanha = {
  nome: "",
  assunto: "",
  preCabecalho: "",
  corpoMarkdown: "Olá, {{nome}}!\n\n",
  rotuloBotao: null,
  urlBotao: null,
  segmento: {},
  categoria: "MARKETING",
};

const OPCOES = {
  situacoes: [["TESTE", "Em teste"], ["ATIVA", "Ativa"], ["INADIMPLENTE", "Inadimplente"], ["VENCIDA", "Vencida"], ["CANCELADA", "Cancelada"]],
  planos: [["MONTHLY", "Mensal"], ["ANNUAL", "Anual"], ["SEM", "Sem plano"]],
  faixas: [["ATE_30", "Até 30"], ["DE_31_A_200", "31–200"], ["DE_201_A_700", "201–700"], ["DE_701_A_1500", "701–1.500"], ["MAIS_DE_1500", "Mais de 1.500"]],
  canais: [["MERCADO_LIVRE", "Mercado Livre"], ["SHOPEE", "Shopee"], ["AMAZON", "Amazon"], ["LOJA_PROPRIA", "Loja própria"], ["OUTROS", "Outros"]],
  comoConheceu: [["INSTAGRAM", "Instagram"], ["YOUTUBE", "YouTube"], ["INDICACAO", "Indicação"], ["GOOGLE", "Google"], ["GRUPO_WHATSAPP", "Grupo de WhatsApp"], ["OUTRO", "Outro"]],
} as const;

function Chips({ opcoes, valores, aoMudar }: { opcoes: ReadonlyArray<readonly [string, string]>; valores: string[] | undefined; aoMudar: (v: string[] | undefined) => void }) {
  const atuais = valores ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map(([valor, rotulo]) => {
        const ativo = atuais.includes(valor);
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={ativo}
            onClick={() => {
              const proximos = ativo ? atuais.filter((v) => v !== valor) : [...atuais, valor];
              aoMudar(proximos.length ? proximos : undefined);
            }}
            className={`rounded-full border px-2.5 py-1 text-xs ${ativo ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

function SimNao({ valor, aoMudar, rotulo }: { valor: boolean | undefined; aoMudar: (v: boolean | undefined) => void; rotulo: string }) {
  return (
    <label className="text-xs text-muted-foreground">
      {rotulo}
      <select
        value={valor === undefined ? "" : valor ? "sim" : "nao"}
        onChange={(e) => aoMudar(e.target.value === "" ? undefined : e.target.value === "sim")}
        className="mt-0.5 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
      >
        <option value="">Tanto faz</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    </label>
  );
}

function numero(valor: string): number | undefined {
  return valor === "" ? undefined : Math.max(0, Math.floor(Number(valor)));
}

export default function EditorCampanhaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const nova = id === "nova";
  const [campanha, setCampanha] = useState<Campanha | null>(nova ? VAZIA : null);
  const [publico, setPublico] = useState<{ total: number; amostra: string[] } | null>(null);
  const [briefing, setBriefing] = useState("");
  const [assuntos, setAssuntos] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [envio, setEnvio] = useState<null | "enviar" | "cancelar">(null);
  const [agendarPara, setAgendarPara] = useState("");

  useEffect(() => {
    if (nova) return;
    fetch(`/api/admin/email/campanhas/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => dados && setCampanha(dados.campanha));
  }, [id, nova]);

  const calcularPublico = useCallback(async (atual: Campanha) => {
    try {
      setPublico(await chamarAdmin("/api/admin/email/publico", "POST", { segmento: atual.segmento, categoria: atual.categoria }));
    } catch {
      setPublico(null);
    }
  }, []);

  useEffect(() => {
    if (!campanha) return;
    const espera = setTimeout(() => calcularPublico(campanha), 400);
    return () => clearTimeout(espera);
  }, [campanha?.segmento, campanha?.categoria, calcularPublico]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!campanha) return <Skeleton className="h-96 w-full" />;
  const editavel = nova || campanha.status === "RASCUNHO";
  const mudar = (parcial: Partial<Campanha>) => setCampanha({ ...campanha, ...parcial });
  const mudarSegmento = (parcial: Partial<Segmento>) => mudar({ segmento: { ...campanha.segmento, ...parcial } });

  const salvar = async () => {
    setSalvando(true);
    try {
      const corpo = {
        nome: campanha.nome,
        assunto: campanha.assunto,
        preCabecalho: campanha.preCabecalho,
        corpoMarkdown: campanha.corpoMarkdown,
        rotuloBotao: campanha.rotuloBotao || null,
        urlBotao: campanha.urlBotao || null,
        segmento: campanha.segmento,
        categoria: campanha.categoria,
      };
      const resposta = nova
        ? await chamarAdmin<{ campanha: Campanha }>("/api/admin/email/campanhas", "POST", corpo)
        : await chamarAdmin<{ campanha: Campanha }>(`/api/admin/email/campanhas/${id}`, "PUT", corpo);
      toast.success("Campanha salva.");
      if (nova) router.replace(`/admin/emails/campanhas/${resposta.campanha.id}`);
      else setCampanha({ ...campanha, ...resposta.campanha });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const { rascunho } = await chamarAdmin<{ rascunho: { assuntos: string[]; preCabecalho: string; corpoMarkdown: string } }>(
        "/api/admin/email/gerar",
        "POST",
        { briefing, categoria: campanha.categoria }
      );
      setAssuntos(rascunho.assuntos);
      mudar({ assunto: rascunho.assuntos[0] ?? campanha.assunto, preCabecalho: rascunho.preCabecalho, corpoMarkdown: rascunho.corpoMarkdown });
      toast.success("Rascunho gerado. Revise antes de enviar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar.");
    } finally {
      setGerando(false);
    }
  };

  const testar = async () => {
    try {
      const r = await chamarAdmin<{ para: string }>(`/api/admin/email/campanhas/${id}/teste`, "POST", {});
      toast.success(`Teste enviado para ${r.para}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falhou.");
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/emails" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> E-mails e campanhas
      </Link>
      <PageHeader
        eyebrow={campanha.status ?? "Nova"}
        title={campanha.nome || "Nova campanha"}
        actions={
          <div className="flex flex-wrap gap-2">
            {editavel && (
              <Button onClick={salvar} disabled={salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar rascunho
              </Button>
            )}
            {!nova && (
              <Button variant="outline" onClick={testar} className="gap-2">
                <Send className="h-4 w-4" /> Enviar teste para mim
              </Button>
            )}
            {!nova && campanha.status === "RASCUNHO" && (
              <Button variant="default" onClick={() => setEnvio("enviar")} disabled={!publico?.total}>
                Enviar ou agendar
              </Button>
            )}
            {!nova && (campanha.status === "AGENDADA" || campanha.status === "ENVIANDO") && (
              <Button variant="outline" className="text-destructive-text" onClick={() => setEnvio("cancelar")}>
                Cancelar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <PainelAdmin titulo="Conteúdo">
            <fieldset disabled={!editavel} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nome">Nome interno</Label>
                <Input id="nome" value={campanha.nome} onChange={(e) => mudar({ nome: e.target.value })} />
              </div>
              <label className="block text-sm">
                Tipo
                <select
                  value={campanha.categoria}
                  onChange={(e) => mudar({ categoria: e.target.value as Campanha["categoria"] })}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="MARKETING">Marketing (só quem consentiu)</option>
                  <option value="CICLO_DE_VIDA">Ciclo de vida (quem não se descadastrou)</option>
                </select>
              </label>
              <div className="space-y-1">
                <Label htmlFor="assunto">Assunto</Label>
                <Input id="assunto" value={campanha.assunto} onChange={(e) => mudar({ assunto: e.target.value })} />
                {assuntos.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {assuntos.map((a) => (
                      <button key={a} type="button" onClick={() => mudar({ assunto: a })} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pre">Pré-cabeçalho</Label>
                <Input id="pre" value={campanha.preCabecalho} onChange={(e) => mudar({ preCabecalho: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="corpo">Corpo (Markdown)</Label>
                <Textarea id="corpo" rows={10} value={campanha.corpoMarkdown} onChange={(e) => mudar({ corpoMarkdown: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="botao">Texto do botão</Label>
                  <Input id="botao" value={campanha.rotuloBotao ?? ""} onChange={(e) => mudar({ rotuloBotao: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="url">Link do botão</Label>
                  <Input id="url" value={campanha.urlBotao ?? ""} onChange={(e) => mudar({ urlBotao: e.target.value })} />
                </div>
              </div>
            </fieldset>
          </PainelAdmin>

          {editavel && (
            <PainelAdmin titulo="Gerar com IA">
              <div className="space-y-3">
                <Textarea
                  rows={3}
                  placeholder="Ex.: avisar que o Skubo agora mostra o lucro por logística (Full, Flex, Coleta) e chamar para abrir o Financeiro."
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  aria-label="Briefing para a IA"
                />
                <Button variant="outline" onClick={gerar} disabled={gerando || briefing.trim().length < 10} className="gap-2">
                  {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar 5 assuntos, pré-cabeçalho e corpo
                </Button>
                <p className="text-xs text-muted-foreground">Segue o guia de voz da marca. Nada é enviado sem você clicar em enviar.</p>
              </div>
            </PainelAdmin>
          )}

          <PainelAdmin
            titulo="Público"
            acao={
              <span className="flex items-center gap-1.5 text-sm font-semibold" data-testid="tamanho-publico">
                <Users className="h-4 w-4" /> {publico ? `${formatNumberBR(publico.total)} pessoa(s)` : "…"}
              </span>
            }
          >
            <fieldset disabled={!editavel} className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Situação da conta</p>
                <Chips opcoes={OPCOES.situacoes} valores={campanha.segmento.situacoes} aoMudar={(v) => mudarSegmento({ situacoes: v })} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Plano</p>
                <Chips opcoes={OPCOES.planos} valores={campanha.segmento.planos} aoMudar={(v) => mudarSegmento({ planos: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="text-xs text-muted-foreground">
                  Cadastro há no mínimo (dias)
                  <Input type="number" min={0} value={campanha.segmento.diasDesdeCadastroMin ?? ""} onChange={(e) => mudarSegmento({ diasDesdeCadastroMin: numero(e.target.value) })} />
                </label>
                <label className="text-xs text-muted-foreground">
                  no máximo (dias)
                  <Input type="number" min={0} value={campanha.segmento.diasDesdeCadastroMax ?? ""} onChange={(e) => mudarSegmento({ diasDesdeCadastroMax: numero(e.target.value) })} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Saldo da IA de
                  <Input type="number" min={0} value={campanha.segmento.saldoIaMin ?? ""} onChange={(e) => mudarSegmento({ saldoIaMin: numero(e.target.value) })} />
                </label>
                <label className="text-xs text-muted-foreground">
                  até
                  <Input type="number" min={0} value={campanha.segmento.saldoIaMax ?? ""} onChange={(e) => mudarSegmento({ saldoIaMax: numero(e.target.value) })} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SimNao rotulo="Mercado Livre conectado" valor={campanha.segmento.mlConectado} aoMudar={(v) => mudarSegmento({ mlConectado: v })} />
                <SimNao rotulo="Bling conectado" valor={campanha.segmento.blingConectado} aoMudar={(v) => mudarSegmento({ blingConectado: v })} />
                <SimNao rotulo="Já comprou perguntas" valor={campanha.segmento.comprouCreditos} aoMudar={(v) => mudarSegmento({ comprouCreditos: v })} />
                <label className="text-xs text-muted-foreground">
                  utm_source
                  <Input value={campanha.segmento.utmSource ?? ""} onChange={(e) => mudarSegmento({ utmSource: e.target.value || undefined })} />
                </label>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Pedidos por mês</p>
                <Chips opcoes={OPCOES.faixas} valores={campanha.segmento.faixas} aoMudar={(v) => mudarSegmento({ faixas: v })} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Onde vende</p>
                <Chips opcoes={OPCOES.canais} valores={campanha.segmento.canais} aoMudar={(v) => mudarSegmento({ canais: v })} />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Como conheceu</p>
                <Chips opcoes={OPCOES.comoConheceu} valores={campanha.segmento.comoConheceu} aoMudar={(v) => mudarSegmento({ comoConheceu: v })} />
              </div>
            </fieldset>
            {publico && publico.amostra.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Exemplos: {publico.amostra.join(", ")}</p>}
            <p className="mt-2 text-xs text-muted-foreground">
              {campanha.categoria === "MARKETING"
                ? "Marketing só alcança quem aceitou receber novidades e ofertas."
                : "Ciclo de vida alcança quem não se descadastrou dessa categoria."}{" "}
              Endereços suprimidos e contas de teste interno ficam de fora.
            </p>
          </PainelAdmin>

          {campanha.metricas && (
            <PainelAdmin titulo="Resultado">
              <dl className="grid grid-cols-3 gap-3 text-sm">
                {Object.entries(campanha.metricas).map(([chave, valor]) => (
                  <div key={chave}>
                    <dt className="text-xs text-muted-foreground">{chave}</dt>
                    <dd className="font-semibold tabular-nums">{formatNumberBR(valor)}</dd>
                  </div>
                ))}
              </dl>
            </PainelAdmin>
          )}
        </div>

        <PainelAdmin titulo="Prévia" className="xl:sticky xl:top-36 xl:self-start">
          <PreviaEmail
            assunto={campanha.assunto}
            preCabecalho={campanha.preCabecalho}
            corpoMarkdown={campanha.corpoMarkdown}
            rotuloBotao={campanha.rotuloBotao}
            urlBotao={campanha.urlBotao}
            categoria={campanha.categoria}
          />
        </PainelAdmin>
      </div>

      <DialogoAcaoAdmin
        aberto={envio !== null}
        aoFechar={() => setEnvio(null)}
        titulo={envio === "cancelar" ? "Cancelar a campanha" : `Enviar para ${formatNumberBR(publico?.total ?? 0)} pessoa(s)`}
        descricao={envio === "cancelar" ? "Os e-mails que ainda estão na fila não saem." : "Sem data, o envio começa agora pela fila (lotes a cada 5 minutos)."}
        perigoso={envio === "cancelar"}
        rotuloConfirmar={envio === "cancelar" ? "Cancelar campanha" : agendarPara ? "Agendar" : "Enviar agora"}
        aoConfirmar={async (motivo) => {
          if (envio === "cancelar") {
            await chamarAdmin(`/api/admin/email/campanhas/${id}/cancelar`, "POST", { motivo });
          } else {
            await chamarAdmin(`/api/admin/email/campanhas/${id}/enviar`, "POST", {
              motivo,
              agendarPara: agendarPara ? new Date(agendarPara).toISOString() : null,
            });
          }
          const r = await fetch(`/api/admin/email/campanhas/${id}`);
          if (r.ok) setCampanha((await r.json()).campanha);
          return envio === "cancelar" ? "Campanha cancelada." : agendarPara ? "Campanha agendada." : "Envio começou.";
        }}
      >
        {envio === "enviar" && (
          <div className="space-y-1.5">
            <Label htmlFor="agendar">Agendar para (opcional)</Label>
            <Input id="agendar" type="datetime-local" value={agendarPara} onChange={(e) => setAgendarPara(e.target.value)} />
          </div>
        )}
      </DialogoAcaoAdmin>
    </div>
  );
}
