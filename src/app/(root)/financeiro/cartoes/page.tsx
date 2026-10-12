"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { formatBRL, formatDateBR } from "@/lib/format";
import { podeEditar } from "@/lib/permissoes";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";

interface ContaFinanceira {
  id: string;
  nome: string;
  tipo: string;
  diaFechamento: number | null;
  diaVencimento: number | null;
  limite: number | null;
}

interface Categoria {
  id: string;
  nome: string;
  grupoDre: string;
}

interface Fornecedor {
  id: string;
  nome: string;
}

interface ItemFatura {
  id: string;
  descricao: string;
  valor: number;
  competencia: string;
  categoria: { nome: string } | null;
}

interface Fatura {
  id: string;
  contaFinanceiraId: string;
  contaFinanceira: { nome: string };
  mesReferencia: string;
  fechamento: string;
  vencimento: string;
  status: "PREVISTO" | "PAGO" | "CANCELADO";
  total: number;
  lancamentos: ItemFatura[];
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function paraCentavos(valor: string): number {
  return Math.round(parseFloat(valor.replace(",", ".")) * 100);
}

interface FormCartao {
  nome: string;
  diaFechamento: string;
  diaVencimento: string;
  limite: string;
}

function formCartaoVazio(): FormCartao {
  return { nome: "", diaFechamento: "10", diaVencimento: "17", limite: "" };
}

interface FormCompra {
  descricao: string;
  valor: string;
  categoriaId: string;
  fornecedorId: string;
  dataCompra: string;
}

function formCompraVazio(): FormCompra {
  return { descricao: "", valor: "", categoriaId: "", fornecedorId: "nenhum", dataCompra: hoje() };
}

export default function CartoesPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro, papel } = useAcessoFinanceiro();
  const podeEditarFinanceiro = papel ? podeEditar(papel, "FINANCEIRO_EDITAR") : false;

  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroCartao, setFiltroCartao] = useState("todos");
  const [faturaExpandidaId, setFaturaExpandidaId] = useState<string | null>(null);

  const [dialogCartaoAberto, setDialogCartaoAberto] = useState(false);
  const [formCartao, setFormCartao] = useState<FormCartao>(formCartaoVazio());
  const [salvandoCartao, setSalvandoCartao] = useState(false);

  const [cartaoDaCompra, setCartaoDaCompra] = useState<ContaFinanceira | null>(null);
  const [formCompra, setFormCompra] = useState<FormCompra>(formCompraVazio());
  const [salvandoCompra, setSalvandoCompra] = useState(false);

  const [faturaParaPagar, setFaturaParaPagar] = useState<Fatura | null>(null);
  const [contaBancariaPagamento, setContaBancariaPagamento] = useState("");
  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [pagando, setPagando] = useState(false);

  const cartoes = useMemo(() => contas.filter((c) => c.tipo === "CARTAO_CREDITO"), [contas]);
  const contasBancarias = useMemo(() => contas.filter((c) => c.tipo !== "CARTAO_CREDITO"), [contas]);

  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    try {
      const params = filtroCartao !== "todos" ? `?contaFinanceiraId=${filtroCartao}` : "";
      const [contasResp, categoriasResp, fornecedoresResp, faturasResp] = await Promise.all([
        fetch("/api/financeiro/contas-financeiras"),
        fetch("/api/financeiro/categorias"),
        fetch("/api/fornecedores"),
        fetch(`/api/financeiro/cartoes/faturas${params}`),
      ]);
      if (contasResp.ok) setContas((await contasResp.json()).contas);
      if (categoriasResp.ok) setCategorias((await categoriasResp.json()).categorias);
      if (fornecedoresResp.ok) setFornecedores(await fornecedoresResp.json());
      if (faturasResp.ok) setFaturas((await faturasResp.json()).faturas);
    } catch (error) {
      console.error("Erro ao carregar cartões:", error);
    } finally {
      setCarregando(false);
    }
  }, [filtroCartao]);

  useEffect(() => {
    if (podeVerFinanceiro) carregarTudo();
  }, [podeVerFinanceiro, carregarTudo]);

  const abrirNovoCartao = () => {
    setFormCartao(formCartaoVazio());
    setDialogCartaoAberto(true);
  };

  const criarCartao = async () => {
    if (!formCartao.nome || !formCartao.diaFechamento || !formCartao.diaVencimento) {
      toast.error("Preencha nome, dia de fechamento e dia de vencimento.");
      return;
    }
    setSalvandoCartao(true);
    try {
      const resposta = await fetch("/api/financeiro/contas-financeiras", {
        method: "POST",
        body: JSON.stringify({
          nome: formCartao.nome,
          tipo: "CARTAO_CREDITO",
          saldoInicial: 0,
          dataSaldoInicial: hoje(),
          diaFechamento: parseInt(formCartao.diaFechamento, 10),
          diaVencimento: parseInt(formCartao.diaVencimento, 10),
          limite: formCartao.limite ? paraCentavos(formCartao.limite) : null,
        }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Cartão criado.");
      setDialogCartaoAberto(false);
      carregarTudo();
    } catch {
      toast.error("Erro ao criar cartão.");
    } finally {
      setSalvandoCartao(false);
    }
  };

  const abrirNovaCompra = (cartao: ContaFinanceira) => {
    setCartaoDaCompra(cartao);
    setFormCompra(formCompraVazio());
  };

  const criarCompra = async () => {
    if (!cartaoDaCompra || !formCompra.descricao || !formCompra.valor || !formCompra.categoriaId || !formCompra.dataCompra) {
      toast.error("Preencha descrição, valor, categoria e data da compra.");
      return;
    }
    setSalvandoCompra(true);
    try {
      const resposta = await fetch("/api/financeiro/cartoes/compras", {
        method: "POST",
        body: JSON.stringify({
          contaFinanceiraId: cartaoDaCompra.id,
          descricao: formCompra.descricao,
          valor: paraCentavos(formCompra.valor),
          categoriaId: formCompra.categoriaId,
          fornecedorId: formCompra.fornecedorId === "nenhum" ? null : formCompra.fornecedorId,
          dataCompra: formCompra.dataCompra,
        }),
      });
      if (!resposta.ok) throw new Error((await resposta.json()).error ?? "Erro ao registrar compra");
      toast.success("Compra registrada no cartão.");
      setCartaoDaCompra(null);
      carregarTudo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar compra.");
    } finally {
      setSalvandoCompra(false);
    }
  };

  const abrirPagarFatura = (fatura: Fatura) => {
    setFaturaParaPagar(fatura);
    setContaBancariaPagamento(contasBancarias[0]?.id ?? "");
    setDataPagamento(hoje());
  };

  const confirmarPagamento = async () => {
    if (!faturaParaPagar || !contaBancariaPagamento) {
      toast.error("Escolha de qual conta o pagamento vai sair.");
      return;
    }
    setPagando(true);
    try {
      const resposta = await fetch(`/api/financeiro/cartoes/faturas/${faturaParaPagar.id}/pagar`, {
        method: "POST",
        body: JSON.stringify({ contaBancariaId: contaBancariaPagamento, dataPagamento }),
      });
      if (!resposta.ok) throw new Error((await resposta.json()).error ?? "Erro ao pagar fatura");
      toast.success("Fatura paga.");
      setFaturaParaPagar(null);
      carregarTudo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao pagar fatura.");
    } finally {
      setPagando(false);
    }
  };

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Cartões"
        subtitle="Cartões de crédito, faturas e pagamentos."
        actions={podeEditarFinanceiro ? <Button onClick={abrirNovoCartao}>Novo cartão</Button> : undefined}
      />

      {carregando ? (
        <Skeleton className="h-[120px] rounded-md" />
      ) : cartoes.length === 0 ? (
        <SectionCard>
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum cartão cadastrado ainda.
            {podeEditarFinanceiro && <> Clique em &quot;Novo cartão&quot; para começar.</>}
          </div>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {cartoes.map((cartao) => (
            <SectionCard key={cartao.id} title={cartao.nome}>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}</div>
                {cartao.limite != null && <div>Limite: {formatBRL(cartao.limite)}</div>}
              </div>
              {podeEditarFinanceiro && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => abrirNovaCompra(cartao)}>
                  Nova compra
                </Button>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      <SectionCard title="Faturas">
        <div className="mb-4">
          <Select value={filtroCartao} onValueChange={setFiltroCartao}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Cartão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cartões</SelectItem>
              {cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {carregando ? (
          <Skeleton className="h-[300px] rounded-md" />
        ) : faturas.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma fatura encontrada.</div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Cartão</DataTableHead>
                <DataTableHead>Mês</DataTableHead>
                <DataTableHead>Fechamento</DataTableHead>
                <DataTableHead>Vencimento</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead className="text-right">Total</DataTableHead>
                <DataTableHead />
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {faturas.map((fatura) => (
                <Fragment key={fatura.id}>
                  <DataTableRow
                    className="cursor-pointer"
                    onClick={() => setFaturaExpandidaId((atual) => (atual === fatura.id ? null : fatura.id))}
                  >
                    <DataTableCell>{fatura.contaFinanceira.nome}</DataTableCell>
                    <DataTableCell>{fatura.mesReferencia}</DataTableCell>
                    <DataTableCell>{formatDateBR(fatura.fechamento)}</DataTableCell>
                    <DataTableCell>{formatDateBR(fatura.vencimento)}</DataTableCell>
                    <DataTableCell>
                      <StatusPill tone={fatura.status === "PAGO" ? "success" : "info"}>
                        {fatura.status === "PAGO" ? "Paga" : "Aberta"}
                      </StatusPill>
                    </DataTableCell>
                    <DataTableCell numeric emphasis>{formatBRL(fatura.total)}</DataTableCell>
                    <DataTableCell onClick={(e) => e.stopPropagation()}>
                      {podeEditarFinanceiro && fatura.status !== "PAGO" && (
                        <Button size="sm" variant="outline" onClick={() => abrirPagarFatura(fatura)}>Pagar</Button>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                  {faturaExpandidaId === fatura.id && (
                    <DataTableRow className="hover:bg-transparent">
                      <DataTableCell colSpan={7} className="bg-muted/30">
                        {fatura.lancamentos.length === 0 ? (
                          <p className="py-2 text-sm text-muted-foreground">Nenhuma compra nesta fatura.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <tbody>
                              {fatura.lancamentos.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-1 pl-4">{formatDateBR(item.competencia)}</td>
                                  <td className="py-1">{item.descricao}</td>
                                  <td className="py-1 text-muted-foreground">{item.categoria?.nome ?? "—"}</td>
                                  <td className="py-1 pr-4 text-right tabular-nums">{formatBRL(item.valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  )}
                </Fragment>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>

      <Dialog open={dialogCartaoAberto} onOpenChange={setDialogCartaoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo cartão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={formCartao.nome} onChange={(e) => setFormCartao({ ...formCartao, nome: e.target.value })} placeholder="Ex.: Nubank" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dia de fechamento</Label>
                <Input type="number" min="1" max="31" value={formCartao.diaFechamento} onChange={(e) => setFormCartao({ ...formCartao, diaFechamento: e.target.value })} />
              </div>
              <div>
                <Label>Dia de vencimento</Label>
                <Input type="number" min="1" max="31" value={formCartao.diaVencimento} onChange={(e) => setFormCartao({ ...formCartao, diaVencimento: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Limite (R$, opcional)</Label>
              <Input type="number" step="0.01" min="0" value={formCartao.limite} onChange={(e) => setFormCartao({ ...formCartao, limite: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={salvandoCartao} onClick={criarCartao}>{salvandoCartao ? "Salvando…" : "Criar cartão"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cartaoDaCompra} onOpenChange={(open) => !open && setCartaoDaCompra(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova compra {cartaoDaCompra && `— ${cartaoDaCompra.nome}`}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Input value={formCompra.descricao} onChange={(e) => setFormCompra({ ...formCompra, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={formCompra.valor} onChange={(e) => setFormCompra({ ...formCompra, valor: e.target.value })} />
              </div>
              <div>
                <Label>Data da compra</Label>
                <Input type="date" value={formCompra.dataCompra} onChange={(e) => setFormCompra({ ...formCompra, dataCompra: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={formCompra.categoriaId} onValueChange={(v) => setFormCompra({ ...formCompra, categoriaId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fornecedor (opcional)</Label>
              <Select value={formCompra.fornecedorId} onValueChange={(v) => setFormCompra({ ...formCompra, fornecedorId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={salvandoCompra} onClick={criarCompra}>{salvandoCompra ? "Salvando…" : "Registrar compra"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!faturaParaPagar} onOpenChange={(open) => !open && setFaturaParaPagar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar fatura {faturaParaPagar && `— ${faturaParaPagar.mesReferencia}`}</DialogTitle>
          </DialogHeader>
          {faturaParaPagar && (
            <div className="space-y-3">
              <p className="text-sm">Total: <span className="font-medium">{formatBRL(faturaParaPagar.total)}</span></p>
              <div>
                <Label>Pagar com a conta</Label>
                <Select value={contaBancariaPagamento} onValueChange={setContaBancariaPagamento}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contasBancarias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                {contasBancarias.length === 0 && (
                  <p className="mt-1 text-xs text-warning">Cadastre uma conta bancária ou caixa antes de pagar uma fatura.</p>
                )}
              </div>
              <div>
                <Label>Data do pagamento</Label>
                <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={pagando || !contaBancariaPagamento} onClick={confirmarPagamento}>
              {pagando ? "Pagando…" : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
