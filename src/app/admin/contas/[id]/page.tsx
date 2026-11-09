"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { DialogoAcaoAdmin, PainelAdmin, ROTULO_SITUACAO, TabelaAdmin, chamarAdmin } from "@/components/admin/ui";
import { formatBRL, formatDateBR, formatNumberBR } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Detalhe = Record<string, any>;

type TipoAcao =
  | "estender-teste"
  | "conceder-dias"
  | "conceder-creditos"
  | "liberar-ia"
  | "aplicar-cupom"
  | "cancelar-assinatura"
  | "teste-interno"
  | "bloquear"
  | "desbloquear"
  | "reenviar-email"
  | "executar-exclusao";

const TITULOS: Record<TipoAcao, string> = {
  "estender-teste": "Estender o teste",
  "conceder-dias": "Conceder dias de assinatura",
  "conceder-creditos": "Conceder perguntas da IA",
  "liberar-ia": "Uso ilimitado da IA",
  "aplicar-cupom": "Aplicar cupom na próxima assinatura",
  "cancelar-assinatura": "Cancelar a assinatura no Mercado Pago",
  "teste-interno": "Conta de teste interno",
  bloquear: "Bloquear a conta",
  desbloquear: "Desbloquear a conta",
  "reenviar-email": "Reenviar e-mail",
  "executar-exclusao": "Excluir a conta (LGPD)",
};

function data(valor: string | null | undefined) {
  return valor ? formatDateBR(valor) : "—";
}

export default function AdminContaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<TipoAcao | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    const resposta = await fetch(`/api/admin/contas/${id}`);
    if (!resposta.ok) {
      setErro((await resposta.json().catch(() => null))?.error ?? "Conta não encontrada");
      return;
    }
    setDetalhe(await resposta.json());
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = (tipo: TipoAcao, iniciais: Record<string, string> = {}) => {
    setCampos(iniciais);
    setAcao(tipo);
  };

  const executar = async (motivo: string) => {
    if (!acao) return;
    const corpo: Record<string, unknown> = { acao, motivo };
    if (acao === "estender-teste" || acao === "conceder-dias") corpo.dias = Number(campos.dias);
    if (acao === "conceder-creditos") {
      corpo.quantidade = Number(campos.quantidade);
      corpo.validadeDias = Number(campos.validadeDias || 365);
    }
    if (acao === "liberar-ia") corpo.liberar = campos.valor === "sim";
    if (acao === "teste-interno") corpo.valor = campos.valor === "sim";
    if (acao === "aplicar-cupom") corpo.codigo = campos.codigo;
    if (acao === "reenviar-email") corpo.emailId = campos.emailId;
    if (acao === "executar-exclusao") corpo.confirmacaoEmail = campos.confirmacaoEmail;
    await chamarAdmin(`/api/admin/contas/${id}/acoes`, "POST", corpo);
    if (acao === "executar-exclusao") {
      router.push("/admin/contas");
      return "Conta excluída.";
    }
    await carregar();
    return "Feito e registrado na auditoria.";
  };

  if (erro) {
    return (
      <div className="space-y-4">
        <Link href="/admin/contas" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Contas
        </Link>
        <p className="text-sm">{erro}</p>
      </div>
    );
  }
  if (!detalhe) return <Skeleton className="h-96 w-full" />;

  const { conta, perfil, situacao, assinatura, creditos, indicacoes } = detalhe;
  const rotuloSituacao = ROTULO_SITUACAO[situacao.status] ?? { texto: situacao.status, tom: "neutral" as const };

  return (
    <div className="space-y-6">
      <Link href="/admin/contas" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Contas
      </Link>
      <PageHeader
        eyebrow={conta.email}
        title={perfil?.nomeLoja ?? conta.nome ?? "Conta sem nome"}
        subtitle={`Desde ${data(conta.criadaEm)} · último login ${data(conta.ultimoLoginEm)}`}
        actions={<StatusPill tone={rotuloSituacao.tom}>{rotuloSituacao.texto}</StatusPill>}
      />

      <PainelAdmin titulo="Ações">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => abrir("estender-teste", { dias: "7" })}>Estender teste</Button>
          <Button size="sm" variant="outline" onClick={() => abrir("conceder-dias", { dias: "7" })}>Conceder dias</Button>
          <Button size="sm" variant="outline" onClick={() => abrir("conceder-creditos", { quantidade: "25", validadeDias: "365" })}>Conceder perguntas da IA</Button>
          <Button size="sm" variant="outline" onClick={() => abrir("liberar-ia", { valor: assinatura?.iaLiberadaManual ? "nao" : "sim" })}>
            {assinatura?.iaLiberadaManual ? "Tirar IA ilimitada" : "Liberar IA ilimitada"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => abrir("aplicar-cupom", { codigo: "" })}>Aplicar cupom</Button>
          <Button size="sm" variant="outline" onClick={() => abrir("teste-interno", { valor: perfil?.testeInterno ? "nao" : "sim" })}>
            {perfil?.testeInterno ? "Desmarcar teste interno" : "Marcar teste interno"}
          </Button>
          {assinatura?.mpPreapprovalId && assinatura.status !== "CANCELED" && (
            <Button size="sm" variant="outline" onClick={() => abrir("cancelar-assinatura")}>Cancelar assinatura</Button>
          )}
          {conta.bloqueadoEm ? (
            <Button size="sm" variant="outline" onClick={() => abrir("desbloquear")}>Desbloquear</Button>
          ) : (
            <Button size="sm" variant="outline" className="text-destructive-text" onClick={() => abrir("bloquear")}>Bloquear</Button>
          )}
          <Button size="sm" variant="outline" className="text-destructive-text" onClick={() => abrir("executar-exclusao", { confirmacaoEmail: "" })}>
            Excluir conta (LGPD)
          </Button>
        </div>
        {conta.bloqueadoEm && <p className="mt-3 text-sm text-destructive-text">Bloqueada em {data(conta.bloqueadoEm)}: {conta.motivoBloqueio}</p>}
      </PainelAdmin>

      <div className="grid gap-4 xl:grid-cols-2">
        <PainelAdmin titulo="Situação e assinatura">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Situação</dt>
            <dd>{rotuloSituacao.texto}{situacao.podeUsar ? "" : " (sem acesso)"}</dd>
            <dt className="text-muted-foreground">Plano</dt>
            <dd>{assinatura?.plan === "ANNUAL" ? "Anual" : assinatura?.plan === "MONTHLY" ? "Mensal" : "—"}</dd>
            <dt className="text-muted-foreground">Preço contratado</dt>
            <dd>{assinatura?.precoContratadoCentavos ? formatBRL(assinatura.precoContratadoCentavos) : "—"}</dd>
            <dt className="text-muted-foreground">Fim do teste</dt>
            <dd>{data(assinatura?.trialEndsAt)}</dd>
            <dt className="text-muted-foreground">Período até</dt>
            <dd>{data(assinatura?.currentPeriodEnd)}</dd>
            <dt className="text-muted-foreground">Próxima cobrança</dt>
            <dd>{data(assinatura?.proximaCobrancaEm)}</dd>
            <dt className="text-muted-foreground">Dias de crédito guardados</dt>
            <dd>{situacao.diasDeCredito}</dd>
            <dt className="text-muted-foreground">IA</dt>
            <dd>{assinatura?.iaLiberadaManual ? "Ilimitada (manual)" : `${formatNumberBR(creditos.saldo)} perguntas`}</dd>
          </dl>
        </PainelAdmin>
        <PainelAdmin titulo="Perfil e origem">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">WhatsApp</dt>
            <dd>{perfil?.whatsapp ?? "—"}</dd>
            <dt className="text-muted-foreground">Pedidos/mês</dt>
            <dd>{perfil?.faixaPedidosMes ?? "—"}</dd>
            <dt className="text-muted-foreground">Canais</dt>
            <dd>{perfil?.canais?.join(", ") || "—"}</dd>
            <dt className="text-muted-foreground">Como conheceu</dt>
            <dd>{perfil?.comoConheceu ?? "—"}</dd>
            <dt className="text-muted-foreground">UTM</dt>
            <dd className="break-all">{[perfil?.utmSource, perfil?.utmMedium, perfil?.utmCampaign].filter(Boolean).join(" / ") || "—"}</dd>
            <dt className="text-muted-foreground">Entrada</dt>
            <dd className="break-all">{perfil?.paginaEntrada ?? "—"}</dd>
            <dt className="text-muted-foreground">Veio de</dt>
            <dd className="break-all">{perfil?.referrer ?? "—"}</dd>
            <dt className="text-muted-foreground">Código de indicação</dt>
            <dd>{perfil?.codigoIndicacao ?? "—"}</dd>
            <dt className="text-muted-foreground">Integrações</dt>
            <dd>
              {detalhe.integracoes.mercadoLivre.map((m: Detalhe) => `ML ${m.nickname}${m.isActive ? "" : " (inativa)"}`).join(", ") || "Sem ML"}
              {" · "}
              {detalhe.integracoes.bling.length ? `Bling${detalhe.integracoes.bling.some((b: Detalhe) => b.isActive) ? "" : " (inativo)"}` : "Sem Bling"}
            </dd>
          </dl>
        </PainelAdmin>
      </div>

      <PainelAdmin titulo="Equipe">
        <TabelaAdmin
          colunas={[{ titulo: "Pessoa" }, { titulo: "Papel" }, { titulo: "E-mail verificado" }, { titulo: "Último login", alinhar: "direita" }]}
          linhas={[
            [`${conta.nome ?? ""} (dono) · ${conta.email}`, "Administrador", conta.emailVerificadoEm ? "Sim" : "Não", data(conta.ultimoLoginEm)],
            ...detalhe.membros.map((m: Detalhe) => [
              <Link key="m" href={`/admin/usuarios?busca=${encodeURIComponent(m.email)}`} className="hover:underline">{`${m.name ?? ""} · ${m.email}`}</Link>,
              m.role,
              m.emailVerificadoEm ? "Sim" : "Não",
              data(m.ultimoLoginEm),
            ]),
          ]}
        />
      </PainelAdmin>

      <div className="grid gap-4 xl:grid-cols-2">
        <PainelAdmin titulo="Pagamentos">
          <TabelaAdmin
            colunas={[{ titulo: "Data" }, { titulo: "Tipo" }, { titulo: "Status" }, { titulo: "Valor", alinhar: "direita" }]}
            linhas={detalhe.pagamentos.map((p: Detalhe) => [data(p.aprovadoEm ?? p.createdAt), p.tipo === "CREDITO_IA" ? "Perguntas da IA" : "Assinatura", p.status, formatBRL(p.valorCentavos)])}
            vazio="Nenhum pagamento."
          />
        </PainelAdmin>
        <PainelAdmin titulo={`Perguntas da IA · saldo ${formatNumberBR(creditos.saldo)}`}>
          <TabelaAdmin
            colunas={[{ titulo: "Data" }, { titulo: "Movimento" }, { titulo: "Qtd.", alinhar: "direita" }, { titulo: "Saldo", alinhar: "direita" }]}
            linhas={creditos.extrato.map((m: Detalhe) => [data(m.createdAt), m.descricao, m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade, m.saldoApos])}
            vazio="Sem movimentos."
          />
        </PainelAdmin>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PainelAdmin titulo="Indicações feitas">
          <TabelaAdmin
            colunas={[{ titulo: "Indicado" }, { titulo: "Status" }, { titulo: "Motivo" }]}
            linhas={indicacoes.feitas.map((i: Detalhe) => [i.indicadoEmail ?? i.indicado, i.status, i.motivoInvalidacao ?? "—"])}
            vazio="Nenhuma indicação."
          />
          {indicacoes.recebida && (
            <p className="mt-3 text-sm text-fg2">
              Esta conta foi indicada (código {indicacoes.recebida.codigo}) · {indicacoes.recebida.status}
            </p>
          )}
        </PainelAdmin>
        <PainelAdmin titulo="E-mails enviados">
          <TabelaAdmin
            colunas={[{ titulo: "Data" }, { titulo: "Modelo" }, { titulo: "Status" }, { titulo: "" }]}
            linhas={detalhe.emails.map((e: Detalhe) => [
              data(e.createdAt),
              e.modelo,
              e.status,
              e.podeReenviar ? (
                <Button key="r" size="sm" variant="ghost" onClick={() => abrir("reenviar-email", { emailId: e.id })}>Reenviar</Button>
              ) : (
                ""
              ),
            ])}
            vazio="Nenhum e-mail."
          />
        </PainelAdmin>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PainelAdmin titulo="Eventos de produto">
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {detalhe.eventos.map((e: Detalhe) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span>{e.nome}</span>
                <span className="text-muted-foreground">{data(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        </PainelAdmin>
        <PainelAdmin titulo="Consentimentos">
          <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
            {detalhe.consentimentos.map((c: Detalhe) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span>
                  {c.tipo} {c.concedido ? "✓" : "✗"} <span className="text-muted-foreground">({c.origem})</span>
                </span>
                <span className="text-muted-foreground">{data(c.createdAt)}</span>
              </li>
            ))}
          </ul>
        </PainelAdmin>
        <PainelAdmin titulo="Cancelamento e exclusão">
          <ul className="space-y-1 text-sm">
            {detalhe.motivosCancelamento.map((m: Detalhe) => (
              <li key={m.id}>
                {m.motivo}
                {m.comentario ? `: ${m.comentario}` : ""} <span className="text-muted-foreground">({data(m.createdAt)})</span>
              </li>
            ))}
            {detalhe.exclusoes.map((x: Detalhe) => (
              <li key={x.id} className="text-destructive-text">
                Pedido de exclusão {x.status.toLowerCase()} em {data(x.createdAt)}
              </li>
            ))}
            {detalhe.motivosCancelamento.length === 0 && detalhe.exclusoes.length === 0 && <li className="text-muted-foreground">Nada registrado.</li>}
          </ul>
        </PainelAdmin>
      </div>

      <PainelAdmin titulo="Auditoria">
        <TabelaAdmin
          colunas={[{ titulo: "Data" }, { titulo: "Quem" }, { titulo: "Ação" }, { titulo: "Motivo" }]}
          linhas={[
            ...detalhe.auditoria.admin.map((a: Detalhe) => [data(a.createdAt), a.adminEmail, a.acao, a.motivo ?? "—"]),
            ...detalhe.auditoria.conta.map((a: Detalhe) => [data(a.createdAt), "equipe da loja", a.acao, "—"]),
          ]}
          vazio="Sem registros."
        />
      </PainelAdmin>

      <DialogoAcaoAdmin
        aberto={acao !== null}
        aoFechar={() => setAcao(null)}
        titulo={acao ? TITULOS[acao] : ""}
        perigoso={acao === "executar-exclusao" || acao === "bloquear" || acao === "cancelar-assinatura"}
        rotuloConfirmar={acao === "executar-exclusao" ? "Excluir de vez" : "Confirmar"}
        bloquearConfirmar={acao === "executar-exclusao" && campos.confirmacaoEmail?.toLowerCase() !== conta.email.toLowerCase()}
        descricao={
          acao === "executar-exclusao"
            ? "Apaga a loja, os dados de negócio e os dados pessoais em cascata. Não dá para desfazer. A auditoria guarda só o id."
            : acao === "bloquear"
              ? "Ninguém da equipe consegue entrar enquanto estiver bloqueada."
              : undefined
        }
        aoConfirmar={executar}
      >
        {(acao === "estender-teste" || acao === "conceder-dias") && (
          <div className="space-y-1.5">
            <Label htmlFor="dias">Dias</Label>
            <Input id="dias" type="number" min={1} value={campos.dias ?? ""} onChange={(e) => setCampos({ ...campos, dias: e.target.value })} />
          </div>
        )}
        {acao === "conceder-creditos" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantidade">Perguntas</Label>
              <Input id="quantidade" type="number" min={1} value={campos.quantidade ?? ""} onChange={(e) => setCampos({ ...campos, quantidade: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validade">Validade (dias)</Label>
              <Input id="validade" type="number" min={1} value={campos.validadeDias ?? ""} onChange={(e) => setCampos({ ...campos, validadeDias: e.target.value })} />
            </div>
          </div>
        )}
        {acao === "aplicar-cupom" && (
          <div className="space-y-1.5">
            <Label htmlFor="cupom">Código do cupom</Label>
            <Input id="cupom" value={campos.codigo ?? ""} onChange={(e) => setCampos({ ...campos, codigo: e.target.value.toUpperCase() })} />
          </div>
        )}
        {(acao === "liberar-ia" || acao === "teste-interno") && (
          <p className="text-sm">{campos.valor === "sim" ? "Vai ligar." : "Vai desligar."}</p>
        )}
        {acao === "executar-exclusao" && (
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-email">Digite o e-mail do dono ({conta.email})</Label>
            <Input id="confirmar-email" value={campos.confirmacaoEmail ?? ""} onChange={(e) => setCampos({ ...campos, confirmacaoEmail: e.target.value })} />
          </div>
        )}
      </DialogoAcaoAdmin>
    </div>
  );
}
