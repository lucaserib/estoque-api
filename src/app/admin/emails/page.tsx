"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogoAcaoAdmin, PainelAdmin, TabelaAdmin, baixarArquivo, chamarAdmin } from "@/components/admin/ui";
import { PreviaEmail } from "@/components/admin/PreviaEmail";
import { formatDateBR, formatNumberBR } from "@/lib/format";

interface Automacao {
  chave: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  atrasoHoras: number;
  assunto: string;
  preCabecalho: string;
  corpoMarkdown: string;
  rotuloBotao: string | null;
  urlBotao: string | null;
  cupomCodigo: string | null;
  categoria: "TRANSACIONAL" | "CICLO_DE_VIDA" | "MARKETING";
  porTempo: boolean;
  atualizadoPor: string | null;
  updatedAt: string;
}

interface Campanha {
  id: string;
  nome: string;
  status: string;
  categoria: string;
  publicoTotal: number;
  createdAt: string;
  agendadaPara: string | null;
  metricas: { enviados: number; entregues: number; abertos: number; cliques: number; descadastros: number; devolucoes: number; naFila: number };
}

interface Supressao {
  id: string;
  email: string;
  motivo: string;
  detalhe: string | null;
  createdAt: string;
}

type Aba = "automacoes" | "campanhas" | "supressoes" | "contatos";
const ABAS: Array<{ valor: Aba; rotulo: string }> = [
  { valor: "automacoes", rotulo: "Automações" },
  { valor: "campanhas", rotulo: "Campanhas" },
  { valor: "supressoes", rotulo: "Supressões" },
  { valor: "contatos", rotulo: "Contatos para anúncios" },
];

function EditorAutomacao({ automacao, variaveis, aoFechar, aoSalvar }: { automacao: Automacao; variaveis: string[]; aoFechar: () => void; aoSalvar: () => void }) {
  const [rascunho, setRascunho] = useState(automacao);
  const [salvar, setSalvar] = useState(false);
  const [testando, setTestando] = useState(false);

  const testar = async () => {
    setTestando(true);
    try {
      await chamarAdmin(`/api/admin/email/automacoes/${automacao.chave}/teste`, "POST", {});
      toast.success("Teste enviado para o seu e-mail (com o texto salvo).");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falhou.");
    } finally {
      setTestando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{automacao.nome}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{automacao.descricao}</p>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ativa">Ligada</Label>
              <Switch id="ativa" checked={rascunho.ativo} onCheckedChange={(v) => setRascunho({ ...rascunho, ativo: v })} />
            </div>
            {automacao.porTempo && (
              <div className="space-y-1">
                <Label htmlFor="atraso">Atraso (horas depois do gatilho)</Label>
                <Input id="atraso" type="number" min={0} value={rascunho.atrasoHoras} onChange={(e) => setRascunho({ ...rascunho, atrasoHoras: Number(e.target.value) })} />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="assunto">Assunto</Label>
              <Input id="assunto" value={rascunho.assunto} onChange={(e) => setRascunho({ ...rascunho, assunto: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pre">Pré-cabeçalho</Label>
              <Input id="pre" value={rascunho.preCabecalho} onChange={(e) => setRascunho({ ...rascunho, preCabecalho: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="corpo">Corpo (Markdown)</Label>
              <Textarea id="corpo" rows={10} value={rascunho.corpoMarkdown} onChange={(e) => setRascunho({ ...rascunho, corpoMarkdown: e.target.value })} />
              <p className="text-xs text-muted-foreground">Variáveis: {variaveis.map((v) => `{{${v}}}`).join(" ")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="botao">Texto do botão</Label>
                <Input id="botao" value={rascunho.rotuloBotao ?? ""} onChange={(e) => setRascunho({ ...rascunho, rotuloBotao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="url">Link do botão</Label>
                <Input id="url" value={rascunho.urlBotao ?? ""} onChange={(e) => setRascunho({ ...rascunho, urlBotao: e.target.value })} />
              </div>
            </div>
            {(automacao.chave === "volte-3" || automacao.chave === "volte-14") && (
              <div className="space-y-1">
                <Label htmlFor="cupom">Cupom ({"{{cupom}}"})</Label>
                <Input id="cupom" value={rascunho.cupomCodigo ?? ""} onChange={(e) => setRascunho({ ...rascunho, cupomCodigo: e.target.value.toUpperCase() })} />
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => setSalvar(true)}>Salvar</Button>
              <Button variant="outline" onClick={testar} disabled={testando} className="gap-2">
                {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar teste para mim
              </Button>
            </div>
          </div>
          <PreviaEmail
            assunto={rascunho.assunto}
            preCabecalho={rascunho.preCabecalho}
            corpoMarkdown={rascunho.corpoMarkdown}
            rotuloBotao={rascunho.rotuloBotao}
            urlBotao={rascunho.urlBotao}
            categoria={rascunho.categoria}
          />
        </div>
        <DialogoAcaoAdmin
          aberto={salvar}
          aoFechar={() => setSalvar(false)}
          titulo="Salvar a automação"
          aoConfirmar={async (motivo) => {
            await chamarAdmin(`/api/admin/email/automacoes/${automacao.chave}`, "PUT", {
              ativo: rascunho.ativo,
              atrasoHoras: rascunho.atrasoHoras,
              assunto: rascunho.assunto,
              preCabecalho: rascunho.preCabecalho,
              corpoMarkdown: rascunho.corpoMarkdown,
              rotuloBotao: rascunho.rotuloBotao || null,
              urlBotao: rascunho.urlBotao || null,
              cupomCodigo: rascunho.cupomCodigo || null,
              motivo,
            });
            aoSalvar();
            return "Automação salva.";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function AdminEmailsPage() {
  const [aba, setAba] = useState<Aba>("automacoes");
  const [automacoes, setAutomacoes] = useState<Automacao[] | null>(null);
  const [variaveis, setVariaveis] = useState<string[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[] | null>(null);
  const [supressoes, setSupressoes] = useState<Supressao[] | null>(null);
  const [editando, setEditando] = useState<Automacao | null>(null);
  const [buscaSupressao, setBuscaSupressao] = useState("");
  const [supressaoAcao, setSupressaoAcao] = useState<{ email: string; tipo: "remover" | "adicionar" } | null>(null);
  const [novoSuprimido, setNovoSuprimido] = useState("");

  const carregar = useCallback(async () => {
    const [a, c, s] = await Promise.all([
      fetch("/api/admin/email/automacoes"),
      fetch("/api/admin/email/campanhas"),
      fetch(`/api/admin/email/supressoes${buscaSupressao ? `?busca=${encodeURIComponent(buscaSupressao)}` : ""}`),
    ]);
    if (a.ok) {
      const dados = await a.json();
      setAutomacoes(dados.automacoes);
      setVariaveis(dados.variaveis);
    }
    if (c.ok) setCampanhas((await c.json()).campanhas);
    if (s.ok) setSupressoes((await s.json()).supressoes);
  }, [buscaSupressao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="E-mails e campanhas" subtitle="Textos das automações, campanhas, supressões e contatos para anúncios." />
      <div className="flex flex-wrap gap-2" role="tablist">
        {ABAS.map((a) => (
          <Button key={a.valor} role="tab" aria-selected={aba === a.valor} size="sm" variant={aba === a.valor ? "default" : "outline"} onClick={() => setAba(a.valor)}>
            {a.rotulo}
          </Button>
        ))}
      </div>

      {aba === "automacoes" && (
        <PainelAdmin titulo="Automações do ciclo de vida">
          {!automacoes ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <TabelaAdmin
              colunas={[{ titulo: "Automação" }, { titulo: "Quando" }, { titulo: "Categoria" }, { titulo: "Situação" }, { titulo: "" }]}
              linhas={automacoes.map((a) => [
                <span key="n" className="block min-w-[180px]">
                  <span className="block font-medium">{a.nome}</span>
                  <span className="block text-xs text-muted-foreground">{a.assunto}</span>
                </span>,
                a.descricao ?? "—",
                a.categoria === "TRANSACIONAL" ? "Transacional" : a.categoria === "CICLO_DE_VIDA" ? "Ciclo de vida" : "Marketing",
                <StatusPill key="s" tone={a.ativo ? "success" : "neutral"}>{a.ativo ? "Ligada" : "Desligada"}</StatusPill>,
                <Button key="e" size="sm" variant="outline" onClick={() => setEditando(a)}>Editar</Button>,
              ])}
            />
          )}
        </PainelAdmin>
      )}

      {aba === "campanhas" && (
        <PainelAdmin
          titulo="Campanhas"
          acao={
            <Button asChild size="sm" className="gap-2">
              <Link href="/admin/emails/campanhas/nova">
                <Plus className="h-4 w-4" /> Nova campanha
              </Link>
            </Button>
          }
        >
          {!campanhas ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <TabelaAdmin
              colunas={[
                { titulo: "Campanha" },
                { titulo: "Status" },
                { titulo: "Público", alinhar: "direita" },
                { titulo: "Entregues", alinhar: "direita" },
                { titulo: "Abertos", alinhar: "direita" },
                { titulo: "Cliques", alinhar: "direita" },
                { titulo: "Descadastros", alinhar: "direita" },
                { titulo: "Devoluções", alinhar: "direita" },
              ]}
              linhas={campanhas.map((c) => [
                <Link key="c" href={`/admin/emails/campanhas/${c.id}`} className="font-medium hover:underline">{c.nome}</Link>,
                `${c.status}${c.agendadaPara && c.status === "AGENDADA" ? ` · ${formatDateBR(c.agendadaPara)}` : ""}`,
                formatNumberBR(c.publicoTotal),
                formatNumberBR(c.metricas.entregues),
                formatNumberBR(c.metricas.abertos),
                formatNumberBR(c.metricas.cliques),
                formatNumberBR(c.metricas.descadastros),
                formatNumberBR(c.metricas.devolucoes),
              ])}
              vazio="Nenhuma campanha ainda."
            />
          )}
        </PainelAdmin>
      )}

      {aba === "supressoes" && (
        <PainelAdmin titulo="Endereços que não recebem e-mail">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Buscar e-mail" value={buscaSupressao} onChange={(e) => setBuscaSupressao(e.target.value)} aria-label="Buscar supressão" />
            <Input className="max-w-xs" placeholder="Suprimir manualmente: e-mail" value={novoSuprimido} onChange={(e) => setNovoSuprimido(e.target.value)} aria-label="E-mail para suprimir" />
            <Button variant="outline" disabled={!novoSuprimido.includes("@")} onClick={() => setSupressaoAcao({ email: novoSuprimido, tipo: "adicionar" })}>
              Suprimir
            </Button>
          </div>
          {!supressoes ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <TabelaAdmin
              colunas={[{ titulo: "E-mail" }, { titulo: "Motivo" }, { titulo: "Detalhe" }, { titulo: "Desde" }, { titulo: "" }]}
              linhas={supressoes.map((s) => [
                s.email,
                s.motivo,
                s.detalhe ?? "—",
                formatDateBR(s.createdAt),
                s.motivo === "MANUAL" ? (
                  <Button key="r" size="sm" variant="ghost" onClick={() => setSupressaoAcao({ email: s.email, tipo: "remover" })}>Remover</Button>
                ) : (
                  ""
                ),
              ])}
              vazio="Nenhuma supressão."
            />
          )}
        </PainelAdmin>
      )}

      {aba === "contatos" && (
        <PainelAdmin titulo="Contatos com consentimento de marketing">
          <p className="mb-4 text-sm text-fg2">
            Exporta só quem marcou que quer receber novidades: e-mail, telefone (se consentiu no WhatsApp), nome e situação. Serve para subir como
            público personalizado no Meta. A exportação fica registrada na auditoria.
          </p>
          <Button className="gap-2" onClick={() => baixarArquivo("/api/admin/email/contatos")}>
            <Download className="h-4 w-4" /> Baixar CSV
          </Button>
        </PainelAdmin>
      )}

      {editando && (
        <EditorAutomacao
          automacao={editando}
          variaveis={variaveis}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            carregar();
          }}
        />
      )}

      <DialogoAcaoAdmin
        aberto={supressaoAcao !== null}
        aoFechar={() => setSupressaoAcao(null)}
        titulo={supressaoAcao?.tipo === "remover" ? "Voltar a mandar e-mails" : "Parar de mandar e-mails"}
        descricao={supressaoAcao?.email}
        aoConfirmar={async (motivo) => {
          if (!supressaoAcao) return;
          await chamarAdmin("/api/admin/email/supressoes", supressaoAcao.tipo === "remover" ? "DELETE" : "POST", { email: supressaoAcao.email, motivo });
          setNovoSuprimido("");
          await carregar();
          return "Feito e registrado na auditoria.";
        }}
      />
    </div>
  );
}
