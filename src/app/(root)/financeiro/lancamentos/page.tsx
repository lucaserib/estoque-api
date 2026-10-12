"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { SeletorPeriodo, periodoDoPreset, type PeriodoSelecionado } from "../components/SeletorPeriodo";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";

type Tipo = "RECEITA" | "DESPESA" | "TRANSFERENCIA";
type Status = "PREVISTO" | "PAGO" | "CANCELADO";
type Frequencia = "SEMANAL" | "MENSAL" | "ANUAL";

interface Categoria {
  id: string;
  nome: string;
  grupoDre: string;
  ativo: boolean;
}

interface ContaFinanceira {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

interface Fornecedor {
  id: string;
  nome: string;
}

interface Lancamento {
  id: string;
  tipo: Tipo;
  descricao: string;
  valor: number;
  categoriaId: string;
  categoria: { id: string; nome: string } | null;
  contaFinanceiraId: string | null;
  contaFinanceira: { id: string; nome: string } | null;
  fornecedorId: string | null;
  fornecedor: { id: string; nome: string } | null;
  competencia: string;
  vencimento: string;
  pagamento: string | null;
  status: Status;
  origem: string;
  observacao: string | null;
  parcelaNumero: number | null;
  parcelaTotal: number | null;
}

const ROTULO_GRUPO_DRE: Record<string, string> = {
  RECEITA_BRUTA: "Receita",
  DEDUCAO_RECEITA: "Dedução de receita",
  IMPOSTO_VENDA: "Imposto sobre venda",
  CUSTO_VARIAVEL: "Custo variável",
  CMV: "CMV",
  DESPESA_OPERACIONAL: "Despesa operacional",
  RESULTADO_FINANCEIRO: "Resultado financeiro",
  IMPOSTO_LUCRO: "Imposto sobre lucro",
  NAO_OPERACIONAL: "Não operacional",
};

const DIAS_DA_SEMANA = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
  { value: "7", label: "Domingo" },
];

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function paraCentavos(valor: string): number {
  return Math.round(parseFloat(valor.replace(",", ".")) * 100);
}

function paraDataInput(iso: string): string {
  return iso.slice(0, 10);
}

interface FormUnico {
  tipo: Tipo;
  descricao: string;
  valor: string;
  categoriaId: string;
  contaFinanceiraId: string;
  fornecedorId: string;
  competencia: string;
  vencimento: string;
  pagamento: string;
  observacao: string;
}

function formUnicoVazio(): FormUnico {
  return {
    tipo: "DESPESA",
    descricao: "",
    valor: "",
    categoriaId: "",
    contaFinanceiraId: "nenhuma",
    fornecedorId: "nenhum",
    competencia: hoje(),
    vencimento: hoje(),
    pagamento: "",
    observacao: "",
  };
}

interface FormRecorrente {
  descricao: string;
  valor: string;
  categoriaId: string;
  contaFinanceiraId: string;
  fornecedorId: string;
  frequencia: Frequencia;
  diaVencimento: string;
  inicio: string;
  fim: string;
}

function formRecorrenteVazio(): FormRecorrente {
  return {
    descricao: "",
    valor: "",
    categoriaId: "",
    contaFinanceiraId: "nenhuma",
    fornecedorId: "nenhum",
    frequencia: "MENSAL",
    diaVencimento: "10",
    inicio: hoje(),
    fim: "",
  };
}

interface FormParcelado {
  descricao: string;
  valorTotal: string;
  categoriaId: string;
  contaFinanceiraId: string;
  fornecedorId: string;
  competencia: string;
  primeiroVencimento: string;
  numeroDeParcelas: string;
}

function formParceladoVazio(): FormParcelado {
  return {
    descricao: "",
    valorTotal: "",
    categoriaId: "",
    contaFinanceiraId: "nenhuma",
    fornecedorId: "nenhum",
    competencia: hoje(),
    primeiroVencimento: hoje(),
    numeroDeParcelas: "2",
  };
}

interface FormEdicao {
  tipo: Tipo;
  descricao: string;
  valor: string;
  categoriaId: string;
  contaFinanceiraId: string;
  fornecedorId: string;
  competencia: string;
  vencimento: string;
  pagamento: string;
  status: Status;
  observacao: string;
}

function formEdicaoDe(lancamento: Lancamento): FormEdicao {
  return {
    tipo: lancamento.tipo,
    descricao: lancamento.descricao,
    valor: (lancamento.valor / 100).toFixed(2),
    categoriaId: lancamento.categoriaId,
    contaFinanceiraId: lancamento.contaFinanceiraId ?? "nenhuma",
    fornecedorId: lancamento.fornecedorId ?? "nenhum",
    competencia: paraDataInput(lancamento.competencia),
    vencimento: paraDataInput(lancamento.vencimento),
    pagamento: lancamento.pagamento ? paraDataInput(lancamento.pagamento) : "",
    status: lancamento.status,
    observacao: lancamento.observacao ?? "",
  };
}

export default function LancamentosPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro, papel } = useAcessoFinanceiro();
  const podeEditarFinanceiro = papel ? podeEditar(papel, "FINANCEIRO_EDITAR") : false;

  const [periodo, setPeriodo] = useState<PeriodoSelecionado>({ preset: "mesAtual", ...periodoDoPreset("mesAtual") });
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [categoriaEmLote, setCategoriaEmLote] = useState("");
  const [processandoLote, setProcessandoLote] = useState(false);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [aba, setAba] = useState<"unico" | "recorrente" | "parcelado">("unico");
  const [formUnico, setFormUnico] = useState<FormUnico>(formUnicoVazio());
  const [formRecorrente, setFormRecorrente] = useState<FormRecorrente>(formRecorrenteVazio());
  const [formParcelado, setFormParcelado] = useState<FormParcelado>(formParceladoVazio());
  const [salvando, setSalvando] = useState(false);

  const [lancamentoEditando, setLancamentoEditando] = useState<Lancamento | null>(null);
  const [formEdicao, setFormEdicao] = useState<FormEdicao | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const contasSelecionaveis = useMemo(() => contas.filter((c) => c.tipo !== "CARTAO_CREDITO"), [contas]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        desde: periodo.desde.toISOString(),
        ate: periodo.ate.toISOString(),
      });
      if (statusFiltro !== "todos") params.set("status", statusFiltro);
      if (tipoFiltro !== "todos") params.set("tipo", tipoFiltro);
      if (categoriaFiltro !== "todas") params.set("categoriaId", categoriaFiltro);

      const resposta = await fetch(`/api/financeiro/lancamentos?${params.toString()}`);
      if (resposta.ok) {
        const body = await resposta.json();
        setLancamentos(body.lancamentos);
        setSelecionados(new Set());
      }
    } catch (error) {
      console.error("Erro ao carregar lançamentos:", error);
    } finally {
      setCarregando(false);
    }
  }, [periodo, statusFiltro, tipoFiltro, categoriaFiltro]);

  const carregarAuxiliares = useCallback(async () => {
    try {
      const [categoriasResp, contasResp, fornecedoresResp] = await Promise.all([
        fetch("/api/financeiro/categorias"),
        fetch("/api/financeiro/contas-financeiras"),
        fetch("/api/fornecedores"),
      ]);
      if (categoriasResp.ok) setCategorias((await categoriasResp.json()).categorias);
      if (contasResp.ok) setContas((await contasResp.json()).contas);
      if (fornecedoresResp.ok) setFornecedores(await fornecedoresResp.json());
    } catch (error) {
      console.error("Erro ao carregar categorias/contas/fornecedores:", error);
    }
  }, []);

  useEffect(() => {
    if (podeVerFinanceiro) {
      carregar();
      carregarAuxiliares();
    }
  }, [podeVerFinanceiro, carregar, carregarAuxiliares]);

  const categoriasPorGrupo = useMemo(() => {
    const grupos = new Map<string, Categoria[]>();
    for (const categoria of categorias) {
      const lista = grupos.get(categoria.grupoDre) ?? [];
      lista.push(categoria);
      grupos.set(categoria.grupoDre, lista);
    }
    return grupos;
  }, [categorias]);

  const nomeCategoria = (id: string) => categorias.find((c) => c.id === id)?.nome ?? "—";

  function OpcoesCategoria() {
    return (
      <>
        {Array.from(categoriasPorGrupo.entries()).map(([grupo, lista]) => (
          <SelectGroup key={grupo}>
            <SelectLabel>{ROTULO_GRUPO_DRE[grupo] ?? grupo}</SelectLabel>
            {lista.map((categoria) => (
              <SelectItem key={categoria.id} value={categoria.id}>{categoria.nome}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </>
    );
  }

  const toggleSelecionado = (id: string) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const alternarTodos = () => {
    setSelecionados((atual) =>
      atual.size === lancamentos.length ? new Set() : new Set(lancamentos.map((l) => l.id))
    );
  };

  const marcarPagoEmLote = async () => {
    setProcessandoLote(true);
    try {
      const resposta = await fetch("/api/financeiro/lancamentos/lote", {
        method: "POST",
        body: JSON.stringify({ acao: "marcar_pago", ids: Array.from(selecionados) }),
      });
      if (!resposta.ok) throw new Error();
      const { atualizados } = await resposta.json();
      toast.success(`${atualizados} lançamento(s) marcado(s) como pago.`);
      carregar();
    } catch {
      toast.error("Erro ao marcar lançamentos como pagos.");
    } finally {
      setProcessandoLote(false);
    }
  };

  const alterarCategoriaEmLote = async () => {
    if (!categoriaEmLote) {
      toast.error("Escolha a categoria de destino.");
      return;
    }
    setProcessandoLote(true);
    try {
      const resposta = await fetch("/api/financeiro/lancamentos/lote", {
        method: "POST",
        body: JSON.stringify({
          acao: "alterar_categoria",
          ids: Array.from(selecionados),
          categoriaId: categoriaEmLote,
        }),
      });
      if (!resposta.ok) throw new Error();
      const { atualizados } = await resposta.json();
      toast.success(`${atualizados} lançamento(s) atualizado(s).`);
      setCategoriaEmLote("");
      carregar();
    } catch {
      toast.error("Erro ao alterar categoria em lote.");
    } finally {
      setProcessandoLote(false);
    }
  };

  const excluirPrevistosEmLote = async () => {
    if (!confirm(`Excluir ${selecionados.size} lançamento(s) previsto(s) selecionado(s)? Lançamentos já pagos não serão afetados.`)) return;
    setProcessandoLote(true);
    try {
      const resposta = await fetch("/api/financeiro/lancamentos/lote", {
        method: "POST",
        body: JSON.stringify({ acao: "excluir_previstos", ids: Array.from(selecionados) }),
      });
      if (!resposta.ok) throw new Error();
      const { excluidos } = await resposta.json();
      toast.success(`${excluidos} lançamento(s) excluído(s).`);
      carregar();
    } catch {
      toast.error("Erro ao excluir lançamentos.");
    } finally {
      setProcessandoLote(false);
    }
  };

  const abrirCriacao = () => {
    setFormUnico(formUnicoVazio());
    setFormRecorrente(formRecorrenteVazio());
    setFormParcelado(formParceladoVazio());
    setAba("unico");
    setDialogAberto(true);
  };

  const criarUnico = async () => {
    if (!formUnico.descricao || !formUnico.valor || !formUnico.categoriaId || !formUnico.vencimento) {
      toast.error("Preencha descrição, valor, categoria e vencimento.");
      return;
    }
    setSalvando(true);
    try {
      const resposta = await fetch("/api/financeiro/lancamentos", {
        method: "POST",
        body: JSON.stringify({
          tipo: formUnico.tipo,
          descricao: formUnico.descricao,
          valor: paraCentavos(formUnico.valor),
          categoriaId: formUnico.categoriaId,
          contaFinanceiraId: formUnico.contaFinanceiraId === "nenhuma" ? null : formUnico.contaFinanceiraId,
          fornecedorId: formUnico.fornecedorId === "nenhum" ? null : formUnico.fornecedorId,
          competencia: formUnico.competencia,
          vencimento: formUnico.vencimento,
          pagamento: formUnico.pagamento || null,
          observacao: formUnico.observacao || null,
        }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Lançamento criado.");
      setDialogAberto(false);
      carregar();
    } catch {
      toast.error("Erro ao criar lançamento.");
    } finally {
      setSalvando(false);
    }
  };

  const criarRecorrente = async () => {
    if (!formRecorrente.descricao || !formRecorrente.valor || !formRecorrente.categoriaId || !formRecorrente.diaVencimento || !formRecorrente.inicio) {
      toast.error("Preencha descrição, valor, categoria, dia de vencimento e início.");
      return;
    }
    setSalvando(true);
    try {
      const resposta = await fetch("/api/financeiro/recorrencias", {
        method: "POST",
        body: JSON.stringify({
          descricao: formRecorrente.descricao,
          valor: paraCentavos(formRecorrente.valor),
          categoriaId: formRecorrente.categoriaId,
          contaFinanceiraId: formRecorrente.contaFinanceiraId === "nenhuma" ? null : formRecorrente.contaFinanceiraId,
          fornecedorId: formRecorrente.fornecedorId === "nenhum" ? null : formRecorrente.fornecedorId,
          frequencia: formRecorrente.frequencia,
          diaVencimento: parseInt(formRecorrente.diaVencimento, 10),
          inicio: formRecorrente.inicio,
          fim: formRecorrente.fim || null,
        }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Recorrência criada e lançamentos dos próximos meses gerados.");
      setDialogAberto(false);
      carregar();
    } catch {
      toast.error("Erro ao criar recorrência.");
    } finally {
      setSalvando(false);
    }
  };

  const criarParcelado = async () => {
    const numeroDeParcelas = parseInt(formParcelado.numeroDeParcelas, 10);
    if (!formParcelado.descricao || !formParcelado.valorTotal || !formParcelado.categoriaId || !formParcelado.primeiroVencimento || !numeroDeParcelas || numeroDeParcelas < 2) {
      toast.error("Preencha descrição, valor total, categoria, primeiro vencimento e um número de parcelas maior ou igual a 2.");
      return;
    }
    setSalvando(true);
    try {
      const resposta = await fetch("/api/financeiro/lancamentos/parcelado", {
        method: "POST",
        body: JSON.stringify({
          descricao: formParcelado.descricao,
          valorTotal: paraCentavos(formParcelado.valorTotal),
          categoriaId: formParcelado.categoriaId,
          contaFinanceiraId: formParcelado.contaFinanceiraId === "nenhuma" ? null : formParcelado.contaFinanceiraId,
          fornecedorId: formParcelado.fornecedorId === "nenhum" ? null : formParcelado.fornecedorId,
          competencia: formParcelado.competencia,
          primeiroVencimento: formParcelado.primeiroVencimento,
          numeroDeParcelas,
        }),
      });
      if (!resposta.ok) throw new Error();
      toast.success(`Compra parcelada em ${numeroDeParcelas}x criada.`);
      setDialogAberto(false);
      carregar();
    } catch {
      toast.error("Erro ao criar compra parcelada.");
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (lancamento: Lancamento) => {
    setLancamentoEditando(lancamento);
    setFormEdicao(formEdicaoDe(lancamento));
  };

  const salvarEdicao = async () => {
    if (!lancamentoEditando || !formEdicao) return;
    if (!formEdicao.descricao || !formEdicao.valor || !formEdicao.categoriaId || !formEdicao.vencimento) {
      toast.error("Preencha descrição, valor, categoria e vencimento.");
      return;
    }
    setSalvandoEdicao(true);
    try {
      const resposta = await fetch(`/api/financeiro/lancamentos/${lancamentoEditando.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tipo: formEdicao.tipo,
          descricao: formEdicao.descricao,
          valor: paraCentavos(formEdicao.valor),
          categoriaId: formEdicao.categoriaId,
          contaFinanceiraId: formEdicao.contaFinanceiraId === "nenhuma" ? null : formEdicao.contaFinanceiraId,
          fornecedorId: formEdicao.fornecedorId === "nenhum" ? null : formEdicao.fornecedorId,
          competencia: formEdicao.competencia,
          vencimento: formEdicao.vencimento,
          pagamento: formEdicao.pagamento || null,
          status: formEdicao.status,
          observacao: formEdicao.observacao || null,
        }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Lançamento atualizado.");
      setLancamentoEditando(null);
      carregar();
    } catch {
      toast.error("Erro ao atualizar lançamento.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluirEdicao = async () => {
    if (!lancamentoEditando) return;
    if (!confirm(`Excluir o lançamento "${lancamentoEditando.descricao}"?`)) return;
    setSalvandoEdicao(true);
    try {
      const resposta = await fetch(`/api/financeiro/lancamentos/${lancamentoEditando.id}`, { method: "DELETE" });
      if (!resposta.ok) throw new Error();
      toast.success("Lançamento excluído.");
      setLancamentoEditando(null);
      carregar();
    } catch {
      toast.error("Erro ao excluir lançamento.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  if (carregandoSessao || !podeVerFinanceiro) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <Skeleton className="h-[80px] rounded-md" />
      </div>
    );
  }

  const hojeData = new Date();
  const tonePorStatus = (lancamento: Lancamento): { tone: "success" | "info" | "critical" | "warning"; rotulo: string } => {
    if (lancamento.status === "PAGO") return { tone: "success", rotulo: "Pago" };
    if (lancamento.status === "CANCELADO") return { tone: "critical", rotulo: "Cancelado" };
    if (new Date(lancamento.vencimento) < hojeData) return { tone: "warning", rotulo: "Vencido" };
    return { tone: "info", rotulo: "Previsto" };
  };

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Lançamentos"
        subtitle="Contas a pagar e a receber — únicas, recorrentes ou parceladas."
        actions={podeEditarFinanceiro ? <Button onClick={abrirCriacao}>Novo lançamento</Button> : undefined}
      />

      <SectionCard>
        <div className="flex flex-wrap items-end gap-3">
          <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="PREVISTO">Previsto</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="RECEITA">Receita</SelectItem>
              <SelectItem value="DESPESA">Despesa</SelectItem>
              <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              <OpcoesCategoria />
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {podeEditarFinanceiro && selecionados.size > 0 && (
        <SectionCard>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{selecionados.size} selecionado(s)</span>
            <Button size="sm" variant="outline" disabled={processandoLote} onClick={marcarPagoEmLote}>
              Marcar como pago
            </Button>
            <Select value={categoriaEmLote} onValueChange={setCategoriaEmLote}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Alterar categoria para…" /></SelectTrigger>
              <SelectContent><OpcoesCategoria /></SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={processandoLote || !categoriaEmLote} onClick={alterarCategoriaEmLote}>
              Aplicar categoria
            </Button>
            <Button size="sm" variant="destructive" disabled={processandoLote} onClick={excluirPrevistosEmLote}>
              Excluir previstos
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`${lancamentos.length} lançamento(s)`}>
        {carregando ? (
          <Skeleton className="h-[400px] rounded-md" />
        ) : lancamentos.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado com esses filtros.</div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                {podeEditarFinanceiro && (
                  <DataTableHead className="w-10">
                    <Checkbox
                      checked={selecionados.size === lancamentos.length}
                      onCheckedChange={alternarTodos}
                    />
                  </DataTableHead>
                )}
                <DataTableHead>Descrição</DataTableHead>
                <DataTableHead>Categoria</DataTableHead>
                <DataTableHead>Conta</DataTableHead>
                <DataTableHead>Vencimento</DataTableHead>
                <DataTableHead>Status</DataTableHead>
                <DataTableHead className="text-right">Valor</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {lancamentos.map((lancamento) => {
                const { tone, rotulo } = tonePorStatus(lancamento);
                const sinal = lancamento.tipo === "RECEITA" ? "+" : lancamento.tipo === "DESPESA" ? "−" : "";
                const cor = lancamento.tipo === "RECEITA" ? "text-success" : lancamento.tipo === "DESPESA" ? "text-destructive" : "text-muted-foreground";
                return (
                  <DataTableRow key={lancamento.id} className="cursor-pointer" onClick={() => abrirEdicao(lancamento)}>
                    {podeEditarFinanceiro && (
                      <DataTableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selecionados.has(lancamento.id)} onCheckedChange={() => toggleSelecionado(lancamento.id)} />
                      </DataTableCell>
                    )}
                    <DataTableCell>
                      {lancamento.descricao}
                      {lancamento.parcelaNumero && lancamento.parcelaTotal && (
                        <span className="ml-1 text-muted-foreground">({lancamento.parcelaNumero}/{lancamento.parcelaTotal})</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>{lancamento.categoria?.nome ?? nomeCategoria(lancamento.categoriaId)}</DataTableCell>
                    <DataTableCell>{lancamento.contaFinanceira?.nome ?? "—"}</DataTableCell>
                    <DataTableCell>{formatDateBR(lancamento.vencimento)}</DataTableCell>
                    <DataTableCell><StatusPill tone={tone}>{rotulo}</StatusPill></DataTableCell>
                    <DataTableCell numeric className={cor}>{sinal} {formatBRL(lancamento.valor)}</DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
          <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unico">Único</TabsTrigger>
              <TabsTrigger value="recorrente">Recorrente</TabsTrigger>
              <TabsTrigger value="parcelado">Parcelado</TabsTrigger>
            </TabsList>

            <TabsContent value="unico" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={formUnico.tipo} onValueChange={(v) => setFormUnico({ ...formUnico, tipo: v as Tipo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DESPESA">Despesa</SelectItem>
                      <SelectItem value="RECEITA">Receita</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={formUnico.valor} onChange={(e) => setFormUnico({ ...formUnico, valor: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={formUnico.descricao} onChange={(e) => setFormUnico({ ...formUnico, descricao: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={formUnico.categoriaId} onValueChange={(v) => setFormUnico({ ...formUnico, categoriaId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><OpcoesCategoria /></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Conta financeira</Label>
                  <Select value={formUnico.contaFinanceiraId} onValueChange={(v) => setFormUnico({ ...formUnico, contaFinanceiraId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma</SelectItem>
                      {contasSelecionaveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Select value={formUnico.fornecedorId} onValueChange={(v) => setFormUnico({ ...formUnico, fornecedorId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Competência</Label>
                  <Input type="date" value={formUnico.competencia} onChange={(e) => setFormUnico({ ...formUnico, competencia: e.target.value })} />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input type="date" value={formUnico.vencimento} onChange={(e) => setFormUnico({ ...formUnico, vencimento: e.target.value })} />
                </div>
                <div>
                  <Label>Pagamento</Label>
                  <Input type="date" value={formUnico.pagamento} onChange={(e) => setFormUnico({ ...formUnico, pagamento: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Preencher o pagamento lança já como Pago; deixe em branco para Previsto.</p>
              <div>
                <Label>Observação</Label>
                <Textarea value={formUnico.observacao} onChange={(e) => setFormUnico({ ...formUnico, observacao: e.target.value })} />
              </div>
              <DialogFooter>
                <Button disabled={salvando} onClick={criarUnico}>{salvando ? "Salvando…" : "Criar lançamento"}</Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="recorrente" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Descrição</Label>
                  <Input value={formRecorrente.descricao} onChange={(e) => setFormRecorrente({ ...formRecorrente, descricao: e.target.value })} />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={formRecorrente.valor} onChange={(e) => setFormRecorrente({ ...formRecorrente, valor: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={formRecorrente.categoriaId} onValueChange={(v) => setFormRecorrente({ ...formRecorrente, categoriaId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><OpcoesCategoria /></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Conta financeira</Label>
                  <Select value={formRecorrente.contaFinanceiraId} onValueChange={(v) => setFormRecorrente({ ...formRecorrente, contaFinanceiraId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma</SelectItem>
                      {contasSelecionaveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Select value={formRecorrente.fornecedorId} onValueChange={(v) => setFormRecorrente({ ...formRecorrente, fornecedorId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Frequência</Label>
                  <Select
                    value={formRecorrente.frequencia}
                    onValueChange={(v) => setFormRecorrente({ ...formRecorrente, frequencia: v as Frequencia, diaVencimento: v === "SEMANAL" ? "1" : "10" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEMANAL">Semanal</SelectItem>
                      <SelectItem value="MENSAL">Mensal</SelectItem>
                      <SelectItem value="ANUAL">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{formRecorrente.frequencia === "SEMANAL" ? "Dia da semana" : "Dia do vencimento"}</Label>
                  {formRecorrente.frequencia === "SEMANAL" ? (
                    <Select value={formRecorrente.diaVencimento} onValueChange={(v) => setFormRecorrente({ ...formRecorrente, diaVencimento: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DIAS_DA_SEMANA.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input type="number" min="1" max="31" value={formRecorrente.diaVencimento} onChange={(e) => setFormRecorrente({ ...formRecorrente, diaVencimento: e.target.value })} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={formRecorrente.inicio} onChange={(e) => setFormRecorrente({ ...formRecorrente, inicio: e.target.value })} />
                </div>
                <div>
                  <Label>Fim (opcional)</Label>
                  <Input type="date" value={formRecorrente.fim} onChange={(e) => setFormRecorrente({ ...formRecorrente, fim: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Gera despesas previstas para os próximos meses automaticamente, inclusive agora ao criar.</p>
              <DialogFooter>
                <Button disabled={salvando} onClick={criarRecorrente}>{salvando ? "Salvando…" : "Criar recorrência"}</Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="parcelado" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Descrição</Label>
                  <Input value={formParcelado.descricao} onChange={(e) => setFormParcelado({ ...formParcelado, descricao: e.target.value })} />
                </div>
                <div>
                  <Label>Valor total (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={formParcelado.valorTotal} onChange={(e) => setFormParcelado({ ...formParcelado, valorTotal: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={formParcelado.categoriaId} onValueChange={(v) => setFormParcelado({ ...formParcelado, categoriaId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><OpcoesCategoria /></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Conta financeira</Label>
                  <Select value={formParcelado.contaFinanceiraId} onValueChange={(v) => setFormParcelado({ ...formParcelado, contaFinanceiraId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma</SelectItem>
                      {contasSelecionaveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Select value={formParcelado.fornecedorId} onValueChange={(v) => setFormParcelado({ ...formParcelado, fornecedorId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Competência</Label>
                  <Input type="date" value={formParcelado.competencia} onChange={(e) => setFormParcelado({ ...formParcelado, competencia: e.target.value })} />
                </div>
                <div>
                  <Label>1ª parcela</Label>
                  <Input type="date" value={formParcelado.primeiroVencimento} onChange={(e) => setFormParcelado({ ...formParcelado, primeiroVencimento: e.target.value })} />
                </div>
                <div>
                  <Label>Nº de parcelas</Label>
                  <Input type="number" min="2" value={formParcelado.numeroDeParcelas} onChange={(e) => setFormParcelado({ ...formParcelado, numeroDeParcelas: e.target.value })} />
                </div>
              </div>
              {Number(formParcelado.valorTotal) > 0 && Number(formParcelado.numeroDeParcelas) >= 2 && (
                <p className="text-xs text-muted-foreground">
                  Aproximadamente {formParcelado.numeroDeParcelas}x de {formatBRL(Math.round((paraCentavos(formParcelado.valorTotal) / Number(formParcelado.numeroDeParcelas))))}
                </p>
              )}
              <DialogFooter>
                <Button disabled={salvando} onClick={criarParcelado}>{salvando ? "Salvando…" : "Criar parcelamento"}</Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lancamentoEditando} onOpenChange={(open) => !open && setLancamentoEditando(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar lançamento</DialogTitle></DialogHeader>
          {formEdicao && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={formEdicao.tipo} onValueChange={(v) => setFormEdicao({ ...formEdicao, tipo: v as Tipo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DESPESA">Despesa</SelectItem>
                      <SelectItem value="RECEITA">Receita</SelectItem>
                      <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={formEdicao.valor} onChange={(e) => setFormEdicao({ ...formEdicao, valor: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formEdicao.status} onValueChange={(v) => setFormEdicao({ ...formEdicao, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREVISTO">Previsto</SelectItem>
                      <SelectItem value="PAGO">Pago</SelectItem>
                      <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={formEdicao.descricao} onChange={(e) => setFormEdicao({ ...formEdicao, descricao: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={formEdicao.categoriaId} onValueChange={(v) => setFormEdicao({ ...formEdicao, categoriaId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><OpcoesCategoria /></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Conta financeira</Label>
                  <Select value={formEdicao.contaFinanceiraId} onValueChange={(v) => setFormEdicao({ ...formEdicao, contaFinanceiraId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma</SelectItem>
                      {contasSelecionaveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Select value={formEdicao.fornecedorId} onValueChange={(v) => setFormEdicao({ ...formEdicao, fornecedorId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Competência</Label>
                  <Input type="date" value={formEdicao.competencia} onChange={(e) => setFormEdicao({ ...formEdicao, competencia: e.target.value })} />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input type="date" value={formEdicao.vencimento} onChange={(e) => setFormEdicao({ ...formEdicao, vencimento: e.target.value })} />
                </div>
                <div>
                  <Label>Pagamento</Label>
                  <Input type="date" value={formEdicao.pagamento} onChange={(e) => setFormEdicao({ ...formEdicao, pagamento: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Observação</Label>
                <Textarea value={formEdicao.observacao} onChange={(e) => setFormEdicao({ ...formEdicao, observacao: e.target.value })} />
              </div>
              {lancamentoEditando && lancamentoEditando.origem !== "MANUAL" && (
                <p className="text-xs text-muted-foreground">
                  Lançamento gerado automaticamente ({lancamentoEditando.origem.toLowerCase()}). Editar aqui não afeta a regra que o gerou.
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button variant="destructive" disabled={salvandoEdicao} onClick={excluirEdicao}>Excluir</Button>
                <Button disabled={salvandoEdicao} onClick={salvarEdicao}>{salvandoEdicao ? "Salvando…" : "Salvar"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
