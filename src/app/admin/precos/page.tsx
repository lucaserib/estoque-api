"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DialogoAcaoAdmin, PainelAdmin, TabelaAdmin, chamarAdmin } from "@/components/admin/ui";
import { formatBRL, formatDateBR } from "@/lib/format";
import type { ConfiguracaoComercial, DadosConfiguracaoComercial } from "@/modules/comercial/configuracao";

type Config = DadosConfiguracaoComercial;
type Versao = ConfiguracaoComercial & { vigenteDesde: string };

interface Cupom {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo: "PERCENTUAL" | "FIXO";
  valor: number;
  alvo: string;
  usosMaximos: number | null;
  usos: number;
  validoAte: string | null;
  ativo: boolean;
}

interface Reajuste {
  id: string;
  plano: "MONTHLY" | "ANNUAL";
  novoPrecoCentavos: number;
  aplicarEm: string;
  status: string;
  afetados: number;
  avisados: number;
  aplicados: number;
  falhas: number;
  motivo: string;
}

const METADADOS = ["versao", "vigenteDesde", "criadaPor", "observacao"];

function reaisParaCentavos(texto: string): number {
  const numero = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function centavosParaTexto(centavos: number | null): string {
  return centavos === null ? "" : (centavos / 100).toFixed(2).replace(".", ",");
}

function CampoReais({ id, rotulo, valor, aoMudar, permitirVazio }: { id: string; rotulo: string; valor: number | null; aoMudar: (v: number | null) => void; permitirVazio?: boolean }) {
  const [texto, setTexto] = useState(centavosParaTexto(valor));
  useEffect(() => setTexto(centavosParaTexto(valor)), [valor]);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={texto}
        placeholder={permitirVazio ? "Sem promoção" : "0,00"}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => aoMudar(permitirVazio && !texto.trim() ? null : reaisParaCentavos(texto))}
      />
    </div>
  );
}

function CampoNumero({ id, rotulo, valor, aoMudar }: { id: string; rotulo: string; valor: number | null; aoMudar: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} type="number" min={0} value={valor ?? ""} onChange={(e) => aoMudar(Number(e.target.value))} />
    </div>
  );
}

function diferencas(anterior: Record<string, unknown>, atual: Record<string, unknown>): string[] {
  const campos = Object.keys(atual).filter((c) => !["versao", "vigenteDesde", "criadaPor", "observacao"].includes(c));
  return campos
    .filter((c) => JSON.stringify(anterior[c]) !== JSON.stringify(atual[c]))
    .map((c) => `${c}: ${JSON.stringify(anterior[c])} → ${JSON.stringify(atual[c])}`);
}

function Previa({ config }: { config: Config }) {
  const primeiro = config.precoPrimeiroMesCentavos;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      <p className="text-lg font-semibold">{config.textosOferta.titulo}</p>
      <p className="text-sm text-muted-foreground">{config.textosOferta.subtitulo}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Mensal</p>
          <p className="text-2xl font-bold tabular-nums">
            {formatBRL(primeiro ?? config.precoMensalCentavos)}
            <span className="text-xs font-normal text-muted-foreground">{primeiro !== null ? " no 1º mês" : " /mês"}</span>
          </p>
          {primeiro !== null && <p className="text-xs text-muted-foreground">Depois {formatBRL(config.precoMensalCentavos)}/mês</p>}
        </div>
        <div className="rounded-lg border-2 border-primary p-3">
          <p className="flex items-center justify-between text-sm font-medium">
            Anual {config.textosOferta.seloAnual && <span className="text-xs text-primary">{config.textosOferta.seloAnual}</span>}
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {formatBRL(config.precoAnualCentavos)}
            <span className="text-xs font-normal text-muted-foreground"> /ano</span>
          </p>
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-xs text-fg2">
        {config.textosOferta.beneficios.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Teste de {config.diasTeste} dias · {config.iaPerguntasTeste} perguntas grátis da IA · pacotes:{" "}
        {config.iaPacotes.filter((p) => p.ativo).map((p) => `${p.nome} por ${formatBRL(p.precoCentavos)}`).join(", ")}
      </p>
    </div>
  );
}

export default function AdminPrecosPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [versoes, setVersoes] = useState<Versao[]>([]);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [reajustes, setReajustes] = useState<Reajuste[]>([]);
  const [salvar, setSalvar] = useState(false);
  const [novoCupom, setNovoCupom] = useState<null | { codigo: string; tipo: "PERCENTUAL" | "FIXO"; valor: string; alvo: string; usosMaximos: string; validoAte: string }>(null);
  const [cupomAlterar, setCupomAlterar] = useState<Cupom | null>(null);
  const [reajuste, setReajuste] = useState<null | { plano: "MONTHLY" | "ANNUAL"; preco: string; aplicarEm: string; motivoCliente: string }>(null);
  const [afetados, setAfetados] = useState<number | null>(null);
  const [cancelarReajuste, setCancelarReajuste] = useState<Reajuste | null>(null);

  const carregar = useCallback(async () => {
    const [c, u, r] = await Promise.all([fetch("/api/admin/comercial/configuracao"), fetch("/api/admin/comercial/cupons"), fetch("/api/admin/comercial/reajustes")]);
    if (c.ok) {
      const dados = await c.json();
      setConfig(Object.fromEntries(Object.entries(dados.atual).filter(([chave]) => !METADADOS.includes(chave))) as Config);
      setVersoes(dados.versoes);
    }
    if (u.ok) setCupons((await u.json()).cupons);
    if (r.ok) setReajustes((await r.json()).reajustes);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!reajuste) return;
    const preco = reaisParaCentavos(reajuste.preco);
    if (!preco) return;
    fetch(`/api/admin/comercial/reajustes?plano=${reajuste.plano}&preco=${preco}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAfetados(d?.afetados ?? null));
  }, [reajuste]);

  const historico = useMemo(
    () =>
      versoes.map((versao, i) => ({
        versao,
        mudancas: versoes[i + 1] ? diferencas(versoes[i + 1] as unknown as Record<string, unknown>, versao as unknown as Record<string, unknown>) : ["Versão inicial"],
      })),
    [versoes]
  );

  if (!config) return <Skeleton className="h-96 w-full" />;
  const mudar = (parcial: Partial<Config>) => setConfig({ ...config, ...parcial });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Preços e ofertas"
        subtitle="Salvar cria uma nova versão. Vale para novas assinaturas; quem já assina mantém o preço contratado até um reajuste."
        actions={<Button onClick={() => setSalvar(true)}>Salvar nova versão</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <PainelAdmin titulo="Assinatura">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CampoNumero id="dias-teste" rotulo="Dias de teste" valor={config.diasTeste} aoMudar={(v) => mudar({ diasTeste: v })} />
              <CampoReais id="mensal" rotulo="Mensal (R$)" valor={config.precoMensalCentavos} aoMudar={(v) => mudar({ precoMensalCentavos: v ?? 0 })} />
              <CampoReais id="primeiro" rotulo="Primeiro mês (R$)" valor={config.precoPrimeiroMesCentavos} permitirVazio aoMudar={(v) => mudar({ precoPrimeiroMesCentavos: v })} />
              <CampoReais id="anual" rotulo="Anual (R$)" valor={config.precoAnualCentavos} aoMudar={(v) => mudar({ precoAnualCentavos: v ?? 0 })} />
              <div className="space-y-1">
                <Label htmlFor="limite-usuarios">Usuários por conta</Label>
                <Input
                  id="limite-usuarios"
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={config.limiteUsuariosPorConta ?? ""}
                  onChange={(e) => mudar({ limiteUsuariosPorConta: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
          </PainelAdmin>

          <PainelAdmin titulo="Skubo IA">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CampoNumero id="ia-teste" rotulo="Perguntas grátis no teste" valor={config.iaPerguntasTeste} aoMudar={(v) => mudar({ iaPerguntasTeste: v })} />
              <CampoNumero id="ia-val-teste" rotulo="Validade do teste (dias)" valor={config.iaValidadeDiasTeste} aoMudar={(v) => mudar({ iaValidadeDiasTeste: v })} />
              <CampoNumero id="ia-val-compra" rotulo="Validade da compra (dias)" valor={config.iaValidadeDiasCompra} aoMudar={(v) => mudar({ iaValidadeDiasCompra: v })} />
              <CampoNumero id="ia-explicacoes" rotulo="Explicações grátis por dia" valor={config.iaExplicacoesGratisPorDia} aoMudar={(v) => mudar({ iaExplicacoesGratisPorDia: v })} />
              {(Object.keys(config.iaPesoPorRecurso) as Array<keyof Config["iaPesoPorRecurso"]>).map((recurso) => (
                <CampoNumero
                  key={recurso}
                  id={`peso-${recurso}`}
                  rotulo={`Peso ${recurso.toLowerCase().replace("_", " ")}`}
                  valor={config.iaPesoPorRecurso[recurso]}
                  aoMudar={(v) => mudar({ iaPesoPorRecurso: { ...config.iaPesoPorRecurso, [recurso]: v } })}
                />
              ))}
            </div>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm">
              Resumo semanal só para assinantes pagantes
              <Switch checked={config.iaResumoSemanalSoAssinantes} onCheckedChange={(v) => mudar({ iaResumoSemanalSoAssinantes: v })} />
            </label>
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium">Pacotes de perguntas</p>
              {config.iaPacotes.map((pacote, i) => (
                <div key={i} className="grid items-end gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1.4fr_0.8fr_1fr_auto_auto_auto]">
                  <div className="space-y-1">
                    <Label htmlFor={`pid-${i}`}>Id</Label>
                    <Input id={`pid-${i}`} value={pacote.id} onChange={(e) => mudar({ iaPacotes: config.iaPacotes.map((p, j) => (j === i ? { ...p, id: e.target.value } : p)) })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`pnome-${i}`}>Nome</Label>
                    <Input id={`pnome-${i}`} value={pacote.nome} onChange={(e) => mudar({ iaPacotes: config.iaPacotes.map((p, j) => (j === i ? { ...p, nome: e.target.value } : p)) })} />
                  </div>
                  <CampoNumero id={`pperg-${i}`} rotulo="Perguntas" valor={pacote.perguntas} aoMudar={(v) => mudar({ iaPacotes: config.iaPacotes.map((p, j) => (j === i ? { ...p, perguntas: v } : p)) })} />
                  <CampoReais id={`ppreco-${i}`} rotulo="Preço (R$)" valor={pacote.precoCentavos} aoMudar={(v) => mudar({ iaPacotes: config.iaPacotes.map((p, j) => (j === i ? { ...p, precoCentavos: v ?? 0 } : p)) })} />
                  <label className="flex flex-col items-center gap-1 text-xs">
                    Ativo
                    <Switch checked={pacote.ativo} onCheckedChange={(v) => mudar({ iaPacotes: config.iaPacotes.map((p, j) => (j === i ? { ...p, ativo: v } : p)) })} />
                  </label>
                  <label className="flex flex-col items-center gap-1 text-xs">
                    Destaque
                    <Switch checked={pacote.destaque} onCheckedChange={(v) => mudar({ iaPacotes: config.iaPacotes.map((p, j) => (j === i ? { ...p, destaque: v } : p)) })} />
                  </label>
                  <Button size="icon" variant="ghost" aria-label="Remover pacote" disabled={config.iaPacotes.length === 1} onClick={() => mudar({ iaPacotes: config.iaPacotes.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  mudar({ iaPacotes: [...config.iaPacotes, { id: `pacote-${config.iaPacotes.length + 1}`, nome: "Novo pacote", perguntas: 50, precoCentavos: 4970, ativo: false, destaque: false }] })
                }
              >
                <Plus className="h-4 w-4" /> Novo pacote
              </Button>
            </div>
          </PainelAdmin>

          <PainelAdmin titulo="Indique e ganhe">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CampoNumero id="ind-dias" rotulo="Dias de recompensa" valor={config.indicacao.diasRecompensa} aoMudar={(v) => mudar({ indicacao: { ...config.indicacao, diasRecompensa: v } })} />
              <CampoNumero id="ind-carencia" rotulo="Carência (dias)" valor={config.indicacao.carenciaDias} aoMudar={(v) => mudar({ indicacao: { ...config.indicacao, carenciaDias: v } })} />
              <CampoNumero id="ind-limite" rotulo="Recompensas por ano" valor={config.indicacao.limiteRecompensasPorAno} aoMudar={(v) => mudar({ indicacao: { ...config.indicacao, limiteRecompensasPorAno: v } })} />
              <CampoNumero
                id="ind-bonus"
                rotulo="Perguntas para quem entra"
                valor={config.indicacao.bonusIndicado.perguntasIa}
                aoMudar={(v) => mudar({ indicacao: { ...config.indicacao, bonusIndicado: { ...config.indicacao.bonusIndicado, perguntasIa: v } } })}
              />
              <CampoNumero
                id="ind-teste"
                rotulo="Dias extras de teste para quem entra"
                valor={config.indicacao.bonusIndicado.diasTesteExtra}
                aoMudar={(v) => mudar({ indicacao: { ...config.indicacao, bonusIndicado: { ...config.indicacao.bonusIndicado, diasTesteExtra: v } } })}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <Switch checked={config.indicacao.ativo} onCheckedChange={(v) => mudar({ indicacao: { ...config.indicacao, ativo: v } })} /> Programa ligado
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={config.indicacao.exigeMlConectado} onCheckedChange={(v) => mudar({ indicacao: { ...config.indicacao, exigeMlConectado: v } })} /> Exige Mercado Livre conectado
              </label>
            </div>
          </PainelAdmin>

          <PainelAdmin titulo="Textos da oferta">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={config.textosOferta.titulo} onChange={(e) => mudar({ textosOferta: { ...config.textosOferta, titulo: e.target.value } })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="subtitulo">Subtítulo</Label>
                <Input id="subtitulo" value={config.textosOferta.subtitulo} onChange={(e) => mudar({ textosOferta: { ...config.textosOferta, subtitulo: e.target.value } })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="selo">Selo do anual</Label>
                  <Input id="selo" value={config.textosOferta.seloAnual} onChange={(e) => mudar({ textosOferta: { ...config.textosOferta, seloAnual: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cham-mensal">Chamada do mensal</Label>
                  <Input id="cham-mensal" value={config.textosOferta.chamadaMensal} onChange={(e) => mudar({ textosOferta: { ...config.textosOferta, chamadaMensal: e.target.value } })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cham-teste">Botão</Label>
                  <Input id="cham-teste" value={config.textosOferta.chamadaTeste} onChange={(e) => mudar({ textosOferta: { ...config.textosOferta, chamadaTeste: e.target.value } })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="beneficios">Benefícios (um por linha)</Label>
                <Textarea
                  id="beneficios"
                  rows={5}
                  value={config.textosOferta.beneficios.join("\n")}
                  onChange={(e) => mudar({ textosOferta: { ...config.textosOferta, beneficios: e.target.value.split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 8) } })}
                />
              </div>
            </div>
          </PainelAdmin>
        </div>

        <div className="space-y-6">
          <PainelAdmin titulo="Prévia de /planos e /assinatura" className="xl:sticky xl:top-36">
            <Previa config={config} />
          </PainelAdmin>
        </div>
      </div>

      <PainelAdmin titulo="Histórico de versões">
        <ul className="divide-y divide-divider">
          {historico.map(({ versao, mudancas }) => (
            <li key={versao.versao} className="py-3 text-sm">
              <p>
                <strong>v{versao.versao}</strong> · {formatDateBR(versao.vigenteDesde)} · {versao.criadaPor}
                {versao.observacao ? ` · ${versao.observacao}` : ""}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {mudancas.map((m) => (
                  <li key={m} className="break-all">
                    {m}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </PainelAdmin>

      <PainelAdmin
        titulo="Cupons"
        acao={
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setNovoCupom({ codigo: "", tipo: "PERCENTUAL", valor: "10", alvo: "PRIMEIRA_COBRANCA_MENSAL", usosMaximos: "", validoAte: "" })}>
            <Plus className="h-4 w-4" /> Novo cupom
          </Button>
        }
      >
        <TabelaAdmin
          colunas={[{ titulo: "Código" }, { titulo: "Desconto" }, { titulo: "Vale para" }, { titulo: "Usos" }, { titulo: "Validade" }, { titulo: "Situação" }]}
          linhas={cupons.map((c) => [
            c.codigo,
            c.tipo === "PERCENTUAL" ? `${c.valor}%` : formatBRL(c.valor),
            c.alvo === "PACOTE_IA" ? "Pacote de IA" : c.alvo === "ANUAL" ? "Anual" : "1ª mensalidade",
            `${c.usos}${c.usosMaximos ? ` / ${c.usosMaximos}` : ""}`,
            c.validoAte ? formatDateBR(c.validoAte) : "Sem prazo",
            <Button key="s" size="sm" variant="ghost" onClick={() => setCupomAlterar(c)}>
              <StatusPill tone={c.ativo ? "success" : "neutral"}>{c.ativo ? "Ativo" : "Inativo"}</StatusPill>
            </Button>,
          ])}
          vazio="Nenhum cupom."
        />
      </PainelAdmin>

      <PainelAdmin
        titulo="Reajuste de quem já assina"
        acao={
          <Button size="sm" variant="outline" onClick={() => setReajuste({ plano: "MONTHLY", preco: "", aplicarEm: "", motivoCliente: "" })}>
            Agendar reajuste
          </Button>
        }
      >
        <TabelaAdmin
          colunas={[{ titulo: "Plano" }, { titulo: "Novo preço", alinhar: "direita" }, { titulo: "Data" }, { titulo: "Status" }, { titulo: "Afetados", alinhar: "direita" }, { titulo: "Aplicados", alinhar: "direita" }, { titulo: "" }]}
          linhas={reajustes.map((r) => [
            r.plano === "ANNUAL" ? "Anual" : "Mensal",
            formatBRL(r.novoPrecoCentavos),
            formatDateBR(r.aplicarEm),
            r.status,
            `${r.afetados} (${r.avisados} avisados)`,
            `${r.aplicados}${r.falhas ? ` · ${r.falhas} falhas` : ""}`,
            r.status === "AGENDADO" ? (
              <Button key="c" size="sm" variant="ghost" onClick={() => setCancelarReajuste(r)}>Cancelar</Button>
            ) : (
              ""
            ),
          ])}
          vazio="Nenhum reajuste."
        />
      </PainelAdmin>

      <DialogoAcaoAdmin
        aberto={salvar}
        aoFechar={() => setSalvar(false)}
        titulo="Salvar nova versão da configuração"
        descricao="Os novos preços valem para novas assinaturas e para a página /planos em até 1 minuto."
        aoConfirmar={async (motivo) => {
          await chamarAdmin("/api/admin/comercial/configuracao", "PUT", { configuracao: config, motivo });
          await carregar();
          return "Nova versão salva.";
        }}
      />

      <DialogoAcaoAdmin
        aberto={novoCupom !== null}
        aoFechar={() => setNovoCupom(null)}
        titulo="Novo cupom"
        aoConfirmar={async (motivo) => {
          if (!novoCupom) return;
          await chamarAdmin("/api/admin/comercial/cupons", "POST", {
            codigo: novoCupom.codigo,
            tipo: novoCupom.tipo,
            valor: novoCupom.tipo === "PERCENTUAL" ? Number(novoCupom.valor) : reaisParaCentavos(novoCupom.valor),
            alvo: novoCupom.alvo,
            usosMaximos: novoCupom.usosMaximos ? Number(novoCupom.usosMaximos) : null,
            validoAte: novoCupom.validoAte ? new Date(`${novoCupom.validoAte}T23:59:59-03:00`).toISOString() : null,
            motivo,
          });
          await carregar();
          return "Cupom criado.";
        }}
      >
        {novoCupom && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" value={novoCupom.codigo} onChange={(e) => setNovoCupom({ ...novoCupom, codigo: e.target.value.toUpperCase() })} />
            </div>
            <label className="text-sm">
              Tipo
              <select value={novoCupom.tipo} onChange={(e) => setNovoCupom({ ...novoCupom, tipo: e.target.value as "PERCENTUAL" | "FIXO" })} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2">
                <option value="PERCENTUAL">Percentual</option>
                <option value="FIXO">Valor fixo</option>
              </select>
            </label>
            <div className="space-y-1">
              <Label htmlFor="valor">{novoCupom.tipo === "PERCENTUAL" ? "Desconto (%)" : "Desconto (R$)"}</Label>
              <Input id="valor" value={novoCupom.valor} onChange={(e) => setNovoCupom({ ...novoCupom, valor: e.target.value })} />
            </div>
            <label className="col-span-2 text-sm">
              Vale para
              <select value={novoCupom.alvo} onChange={(e) => setNovoCupom({ ...novoCupom, alvo: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2">
                <option value="PRIMEIRA_COBRANCA_MENSAL">Primeira mensalidade</option>
                <option value="ANUAL">Plano anual</option>
                <option value="PACOTE_IA">Pacote de perguntas da IA</option>
              </select>
            </label>
            <div className="space-y-1">
              <Label htmlFor="usos">Usos máximos</Label>
              <Input id="usos" type="number" min={1} placeholder="Sem limite" value={novoCupom.usosMaximos} onChange={(e) => setNovoCupom({ ...novoCupom, usosMaximos: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="validade">Válido até</Label>
              <Input id="validade" type="date" value={novoCupom.validoAte} onChange={(e) => setNovoCupom({ ...novoCupom, validoAte: e.target.value })} />
            </div>
          </div>
        )}
      </DialogoAcaoAdmin>

      <DialogoAcaoAdmin
        aberto={cupomAlterar !== null}
        aoFechar={() => setCupomAlterar(null)}
        titulo={cupomAlterar?.ativo ? `Desativar ${cupomAlterar?.codigo}` : `Ativar ${cupomAlterar?.codigo}`}
        aoConfirmar={async (motivo) => {
          if (!cupomAlterar) return;
          await chamarAdmin(`/api/admin/comercial/cupons/${cupomAlterar.id}`, "PATCH", { ativo: !cupomAlterar.ativo, motivo });
          await carregar();
          return "Cupom atualizado.";
        }}
      />

      <DialogoAcaoAdmin
        aberto={reajuste !== null}
        aoFechar={() => {
          setReajuste(null);
          setAfetados(null);
        }}
        titulo="Agendar reajuste"
        descricao={afetados !== null ? `${afetados} assinatura(s) serão avisadas por e-mail agora e reajustadas na data.` : "Mínimo de 30 dias de antecedência."}
        perigoso
        rotuloConfirmar="Agendar e avisar"
        aoConfirmar={async (motivo) => {
          if (!reajuste) return;
          await chamarAdmin("/api/admin/comercial/reajustes", "POST", {
            plano: reajuste.plano,
            novoPrecoCentavos: reaisParaCentavos(reajuste.preco),
            aplicarEm: new Date(`${reajuste.aplicarEm}T12:00:00-03:00`).toISOString(),
            motivoCliente: reajuste.motivoCliente,
            motivo,
          });
          await carregar();
          return "Reajuste agendado e avisos na fila.";
        }}
      >
        {reajuste && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Plano
              <select value={reajuste.plano} onChange={(e) => setReajuste({ ...reajuste, plano: e.target.value as "MONTHLY" | "ANNUAL" })} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2">
                <option value="MONTHLY">Mensal</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </label>
            <div className="space-y-1">
              <Label htmlFor="novo-preco">Novo preço (R$)</Label>
              <Input id="novo-preco" value={reajuste.preco} onChange={(e) => setReajuste({ ...reajuste, preco: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="data-reajuste">Aplicar em</Label>
              <Input id="data-reajuste" type="date" value={reajuste.aplicarEm} onChange={(e) => setReajuste({ ...reajuste, aplicarEm: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="motivo-cliente">Explicação para os clientes (vai no e-mail)</Label>
              <Textarea id="motivo-cliente" rows={3} value={reajuste.motivoCliente} onChange={(e) => setReajuste({ ...reajuste, motivoCliente: e.target.value })} />
            </div>
          </div>
        )}
      </DialogoAcaoAdmin>

      <DialogoAcaoAdmin
        aberto={cancelarReajuste !== null}
        aoFechar={() => setCancelarReajuste(null)}
        titulo="Cancelar o reajuste"
        aoConfirmar={async (motivo) => {
          if (!cancelarReajuste) return;
          await chamarAdmin(`/api/admin/comercial/reajustes/${cancelarReajuste.id}`, "DELETE", { motivo });
          await carregar();
          toast.info("Lembre de avisar os clientes, se já receberam o e-mail.");
          return "Reajuste cancelado.";
        }}
      />
    </div>
  );
}
