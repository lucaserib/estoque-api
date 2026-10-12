"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LucideLoaderCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { formatBRL } from "@/lib/format";
import { useAcessoFinanceiro } from "../components/useAcessoFinanceiro";

type GrupoDre =
  | "RECEITA_BRUTA" | "DEDUCAO_RECEITA" | "IMPOSTO_VENDA" | "CUSTO_VARIAVEL"
  | "CMV" | "DESPESA_OPERACIONAL" | "RESULTADO_FINANCEIRO" | "IMPOSTO_LUCRO" | "NAO_OPERACIONAL";

interface Categoria {
  id: string;
  nome: string;
  grupoDre: GrupoDre;
  paiId: string | null;
  sistema: boolean;
  ativo: boolean;
}

interface ContaFinanceira {
  id: string;
  nome: string;
  tipo: string;
  saldoInicial: number;
  dataSaldoInicial: string;
  diaFechamento: number | null;
  diaVencimento: number | null;
  limite: number | null;
  ativo: boolean;
}

interface ConfigFinanceiro {
  regimeTributario: "SIMPLES" | "PRESUMIDO" | "REAL";
  aliquotaImposto: number;
  cancelamentoNaCompetencia: "VENDA" | "CANCELAMENTO";
  rateioCustoFixo: "FATURAMENTO" | "UNIDADE" | "NENHUM";
  custoEnvioFlex: number | null;
  usarImpostoEstimado: boolean;
  usarRelatorioLiberacaoMercadoPago: boolean;
}

interface LinhaConciliacao {
  tipo: "TARIFA_VENDA" | "FRETE";
  totalPedidos: number;
  totalFatura: number;
  diferenca: number;
  diferencaPercentual: number | null;
  alerta: boolean;
}

interface LinhaCobrancaNaoMapeada {
  tipoExterno: string;
  quantidade: number;
  total: number;
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

const ROTULO_TIPO_CONTA: Record<string, string> = {
  BANCO: "Banco",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTEIRA_MARKETPLACE: "Carteira de marketplace",
  CAIXA: "Caixa",
};

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function mesAtual(): string {
  return hoje().slice(0, 7);
}

function paraCentavos(valor: string): number {
  return Math.round(parseFloat(valor.replace(",", ".")) * 100);
}

interface FormCategoria {
  nome: string;
  grupoDre: GrupoDre;
  paiId: string;
}

function formCategoriaVazio(): FormCategoria {
  return { nome: "", grupoDre: "DESPESA_OPERACIONAL", paiId: "nenhuma" };
}

interface FormConta {
  nome: string;
  tipo: string;
  saldoInicial: string;
  dataSaldoInicial: string;
  diaFechamento: string;
  diaVencimento: string;
  limite: string;
}

function formContaVazio(): FormConta {
  return { nome: "", tipo: "BANCO", saldoInicial: "0", dataSaldoInicial: hoje(), diaFechamento: "", diaVencimento: "", limite: "" };
}

function formContaDe(conta: ContaFinanceira): FormConta {
  return {
    nome: conta.nome,
    tipo: conta.tipo,
    saldoInicial: (conta.saldoInicial / 100).toFixed(2),
    dataSaldoInicial: conta.dataSaldoInicial.slice(0, 10),
    diaFechamento: conta.diaFechamento != null ? String(conta.diaFechamento) : "",
    diaVencimento: conta.diaVencimento != null ? String(conta.diaVencimento) : "",
    limite: conta.limite != null ? (conta.limite / 100).toFixed(2) : "",
  };
}

export default function ConfiguracoesFinanceiroPage() {
  const { carregando: carregandoSessao, podeVerFinanceiro, papel } = useAcessoFinanceiro();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [config, setConfig] = useState<ConfigFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [aliquotaInput, setAliquotaInput] = useState("0");
  const [custoEnvioFlexInput, setCustoEnvioFlexInput] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const [dialogCategoriaAberto, setDialogCategoriaAberto] = useState(false);
  const [formCategoria, setFormCategoria] = useState<FormCategoria>(formCategoriaVazio());
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);

  const [dialogContaAberto, setDialogContaAberto] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaFinanceira | null>(null);
  const [formConta, setFormConta] = useState<FormConta>(formContaVazio());
  const [salvandoConta, setSalvandoConta] = useState(false);

  const [diasImportar, setDiasImportar] = useState("90");
  const [statusImportacao, setStatusImportacao] = useState<"ocioso" | "em_andamento" | "concluido" | "erro">("ocioso");
  const [totalImportado, setTotalImportado] = useState(0);

  const [mesConciliacao, setMesConciliacao] = useState(mesAtual());
  const [relatorioConciliacao, setRelatorioConciliacao] = useState<LinhaConciliacao[] | null>(null);
  const [carregandoConciliacao, setCarregandoConciliacao] = useState(false);
  const [criandoAjusteTipo, setCriandoAjusteTipo] = useState<string | null>(null);

  const [cobrancasNaoMapeadas, setCobrancasNaoMapeadas] = useState<LinhaCobrancaNaoMapeada[] | null>(null);
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(false);

  const [liberacaoDesde, setLiberacaoDesde] = useState(hoje());
  const [liberacaoAte, setLiberacaoAte] = useState(hoje());
  const [liberacoes, setLiberacoes] = useState<Array<{ referenciaExterna: string | null; valor: number; data: string }> | null>(null);
  const [carregandoLiberacoes, setCarregandoLiberacoes] = useState(false);

  const [pedidoDiagnostico, setPedidoDiagnostico] = useState("");
  const [resultadoDiagnostico, setResultadoDiagnostico] = useState<unknown>(null);
  const [carregandoDiagnostico, setCarregandoDiagnostico] = useState(false);

  const categoriasRaiz = useMemo(() => categorias.filter((c) => c.paiId === null), [categorias]);

  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    try {
      const [categoriasResp, contasResp, configResp] = await Promise.all([
        fetch("/api/financeiro/categorias?incluirInativas=true"),
        fetch("/api/financeiro/contas-financeiras?incluirInativas=true"),
        fetch("/api/financeiro/configuracoes"),
      ]);
      if (categoriasResp.ok) setCategorias((await categoriasResp.json()).categorias);
      if (contasResp.ok) setContas((await contasResp.json()).contas);
      if (configResp.ok) {
        const dados: ConfigFinanceiro = await configResp.json();
        setConfig(dados);
        setAliquotaInput((dados.aliquotaImposto * 100).toFixed(2));
        setCustoEnvioFlexInput(dados.custoEnvioFlex != null ? (dados.custoEnvioFlex / 100).toFixed(2) : "");
      }
    } catch (error) {
      console.error("Erro ao carregar configurações do financeiro:", error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (podeVerFinanceiro) carregarTudo();
  }, [podeVerFinanceiro, carregarTudo]);

  const salvarConfig = async () => {
    if (!config) return;
    setSalvandoConfig(true);
    try {
      const resposta = await fetch("/api/financeiro/configuracoes", {
        method: "PATCH",
        body: JSON.stringify({
          regimeTributario: config.regimeTributario,
          aliquotaImposto: parseFloat(aliquotaInput) / 100,
          cancelamentoNaCompetencia: config.cancelamentoNaCompetencia,
          rateioCustoFixo: config.rateioCustoFixo,
          custoEnvioFlex: custoEnvioFlexInput ? paraCentavos(custoEnvioFlexInput) : null,
          usarImpostoEstimado: config.usarImpostoEstimado,
          usarRelatorioLiberacaoMercadoPago: config.usarRelatorioLiberacaoMercadoPago,
        }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Configurações salvas.");
      carregarTudo();
    } catch {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSalvandoConfig(false);
    }
  };

  const abrirNovaCategoria = () => {
    setFormCategoria(formCategoriaVazio());
    setDialogCategoriaAberto(true);
  };

  const criarCategoria = async () => {
    if (!formCategoria.nome) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    setSalvandoCategoria(true);
    try {
      const resposta = await fetch("/api/financeiro/categorias", {
        method: "POST",
        body: JSON.stringify({
          nome: formCategoria.nome,
          grupoDre: formCategoria.grupoDre,
          paiId: formCategoria.paiId === "nenhuma" ? null : formCategoria.paiId,
        }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Categoria criada.");
      setDialogCategoriaAberto(false);
      carregarTudo();
    } catch {
      toast.error("Erro ao criar categoria.");
    } finally {
      setSalvandoCategoria(false);
    }
  };

  const alternarAtivoCategoria = async (categoria: Categoria) => {
    try {
      const resposta = await fetch(`/api/financeiro/categorias/${categoria.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ativo: !categoria.ativo }),
      });
      if (!resposta.ok) throw new Error();
      carregarTudo();
    } catch {
      toast.error("Erro ao atualizar categoria.");
    }
  };

  const excluirCategoria = async (categoria: Categoria) => {
    if (!confirm(`Excluir a categoria "${categoria.nome}"?`)) return;
    try {
      const resposta = await fetch(`/api/financeiro/categorias/${categoria.id}`, { method: "DELETE" });
      if (!resposta.ok) {
        const body = await resposta.json();
        throw new Error(body.error);
      }
      toast.success("Categoria excluída.");
      carregarTudo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir categoria.");
    }
  };

  const abrirNovaConta = () => {
    setContaEditando(null);
    setFormConta(formContaVazio());
    setDialogContaAberto(true);
  };

  const abrirEdicaoConta = (conta: ContaFinanceira) => {
    setContaEditando(conta);
    setFormConta(formContaDe(conta));
    setDialogContaAberto(true);
  };

  const salvarConta = async () => {
    if (!formConta.nome || !formConta.dataSaldoInicial) {
      toast.error("Preencha nome e data do saldo inicial.");
      return;
    }
    setSalvandoConta(true);
    try {
      const payload = {
        nome: formConta.nome,
        tipo: formConta.tipo,
        saldoInicial: paraCentavos(formConta.saldoInicial || "0"),
        dataSaldoInicial: formConta.dataSaldoInicial,
        diaFechamento: formConta.diaFechamento ? parseInt(formConta.diaFechamento, 10) : null,
        diaVencimento: formConta.diaVencimento ? parseInt(formConta.diaVencimento, 10) : null,
        limite: formConta.limite ? paraCentavos(formConta.limite) : null,
      };
      const resposta = contaEditando
        ? await fetch(`/api/financeiro/contas-financeiras/${contaEditando.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await fetch("/api/financeiro/contas-financeiras", { method: "POST", body: JSON.stringify(payload) });
      if (!resposta.ok) throw new Error();
      toast.success(contaEditando ? "Conta atualizada." : "Conta criada.");
      setDialogContaAberto(false);
      carregarTudo();
    } catch {
      toast.error("Erro ao salvar conta financeira.");
    } finally {
      setSalvandoConta(false);
    }
  };

  const alternarAtivoConta = async (conta: ContaFinanceira) => {
    try {
      const resposta = await fetch(`/api/financeiro/contas-financeiras/${conta.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ativo: !conta.ativo }),
      });
      if (!resposta.ok) throw new Error();
      carregarTudo();
    } catch {
      toast.error("Erro ao atualizar conta financeira.");
    }
  };

  const importarHistorico = async () => {
    setStatusImportacao("em_andamento");
    setTotalImportado(0);
    let total = 0;
    try {
      for (;;) {
        const resposta = await fetch("/api/financeiro/sincronizacao/importar-historico", {
          method: "POST",
          body: JSON.stringify({ dias: parseInt(diasImportar, 10) || 90 }),
        });
        if (!resposta.ok) throw new Error();
        const resultado: { status: "CONCLUIDO" | "EM_ANDAMENTO"; processados: number } = await resposta.json();
        total += resultado.processados;
        setTotalImportado(total);
        if (resultado.status === "CONCLUIDO") break;
      }
      setStatusImportacao("concluido");
      toast.success(`Importação concluída: ${total} pedido(s) processado(s).`);
    } catch {
      setStatusImportacao("erro");
      toast.error("Erro ao importar histórico financeiro.");
    }
  };

  const gerarConciliacao = async () => {
    setCarregandoConciliacao(true);
    try {
      const resposta = await fetch(`/api/financeiro/conciliacao?mes=${mesConciliacao}`);
      if (!resposta.ok) throw new Error();
      setRelatorioConciliacao((await resposta.json()).linhas);
    } catch {
      toast.error("Erro ao gerar relatório de conciliação.");
    } finally {
      setCarregandoConciliacao(false);
    }
  };

  const criarAjusteConciliacao = async (tipo: string) => {
    setCriandoAjusteTipo(tipo);
    try {
      const resposta = await fetch("/api/financeiro/conciliacao/ajuste", {
        method: "POST",
        body: JSON.stringify({ mes: mesConciliacao, tipo }),
      });
      if (!resposta.ok) throw new Error();
      toast.success("Lançamento de ajuste criado.");
    } catch {
      toast.error("Erro ao criar lançamento de ajuste.");
    } finally {
      setCriandoAjusteTipo(null);
    }
  };

  const carregarCobrancasNaoMapeadas = async () => {
    setCarregandoCobrancas(true);
    try {
      const resposta = await fetch(`/api/financeiro/cobrancas-nao-mapeadas?mes=${mesConciliacao}`);
      if (!resposta.ok) throw new Error();
      setCobrancasNaoMapeadas((await resposta.json()).linhas);
    } catch {
      toast.error("Erro ao listar cobranças não mapeadas.");
    } finally {
      setCarregandoCobrancas(false);
    }
  };

  const conferirLiberacoes = async () => {
    setCarregandoLiberacoes(true);
    try {
      const resposta = await fetch(`/api/financeiro/liberacoes?desde=${liberacaoDesde}&ate=${liberacaoAte}`);
      if (!resposta.ok) throw new Error();
      const body = await resposta.json();
      setLiberacoes(body.liberacoes);
    } catch {
      toast.error("Erro ao conferir liberações do Mercado Pago.");
    } finally {
      setCarregandoLiberacoes(false);
    }
  };

  const consultarDiagnostico = async () => {
    if (!pedidoDiagnostico) {
      toast.error("Informe o número do pedido.");
      return;
    }
    setCarregandoDiagnostico(true);
    try {
      const resposta = await fetch(`/api/financeiro/diagnostico/mercado-livre?pedido=${pedidoDiagnostico}`);
      const body = await resposta.json();
      if (!resposta.ok) throw new Error(body.error ?? "Erro no diagnóstico");
      setResultadoDiagnostico(body);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro no diagnóstico.");
    } finally {
      setCarregandoDiagnostico(false);
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
      <PageHeader eyebrow="Financeiro" title="Configurações" subtitle="Plano de contas, contas financeiras, regras e manutenção." />

      {carregando ? (
        <Skeleton className="h-[200px] rounded-md" />
      ) : (
        <>
          <SectionCard title="Plano de contas" actions={<Button size="sm" onClick={abrirNovaCategoria}>Nova categoria</Button>}>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Nome</DataTableHead>
                  <DataTableHead>Grupo (DRE)</DataTableHead>
                  <DataTableHead>Situação</DataTableHead>
                  <DataTableHead />
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {categorias.map((categoria) => (
                  <DataTableRow key={categoria.id}>
                    <DataTableCell>
                      {categoria.nome}
                      {categoria.sistema && <StatusPill tone="neutral" className="ml-2">Sistema</StatusPill>}
                    </DataTableCell>
                    <DataTableCell>{ROTULO_GRUPO_DRE[categoria.grupoDre] ?? categoria.grupoDre}</DataTableCell>
                    <DataTableCell>
                      <Switch checked={categoria.ativo} onCheckedChange={() => alternarAtivoCategoria(categoria)} />
                    </DataTableCell>
                    <DataTableCell>
                      {!categoria.sistema && (
                        <Button size="sm" variant="ghost" onClick={() => excluirCategoria(categoria)}>Excluir</Button>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </SectionCard>

          <SectionCard title="Contas financeiras" actions={<Button size="sm" onClick={abrirNovaConta}>Nova conta</Button>}>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Nome</DataTableHead>
                  <DataTableHead>Tipo</DataTableHead>
                  <DataTableHead className="text-right">Saldo inicial</DataTableHead>
                  <DataTableHead>Situação</DataTableHead>
                  <DataTableHead />
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {contas.map((conta) => (
                  <DataTableRow key={conta.id}>
                    <DataTableCell>{conta.nome}</DataTableCell>
                    <DataTableCell>{ROTULO_TIPO_CONTA[conta.tipo] ?? conta.tipo}</DataTableCell>
                    <DataTableCell numeric>{formatBRL(conta.saldoInicial)}</DataTableCell>
                    <DataTableCell>
                      <Switch checked={conta.ativo} onCheckedChange={() => alternarAtivoConta(conta)} />
                    </DataTableCell>
                    <DataTableCell>
                      <Button size="sm" variant="ghost" onClick={() => abrirEdicaoConta(conta)}>Editar</Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </SectionCard>

          {config && (
            <SectionCard title="Regras do financeiro">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Regime tributário</Label>
                  <Select value={config.regimeTributario} onValueChange={(v) => setConfig({ ...config, regimeTributario: v as ConfigFinanceiro["regimeTributario"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                      <SelectItem value="PRESUMIDO">Lucro Presumido</SelectItem>
                      <SelectItem value="REAL">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">IR/CSLL só entram na DRE fora do Simples Nacional.</p>
                </div>
                <div>
                  <Label>Alíquota de imposto sobre vendas (%)</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={aliquotaInput} onChange={(e) => setAliquotaInput(e.target.value)} />
                </div>
                <div>
                  <Label>Cancelamento entra na DRE</Label>
                  <Select value={config.cancelamentoNaCompetencia} onValueChange={(v) => setConfig({ ...config, cancelamentoNaCompetencia: v as ConfigFinanceiro["cancelamentoNaCompetencia"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VENDA">Na competência da venda</SelectItem>
                      <SelectItem value="CANCELAMENTO">Na competência do cancelamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rateio de custo fixo por produto</Label>
                  <Select value={config.rateioCustoFixo} onValueChange={(v) => setConfig({ ...config, rateioCustoFixo: v as ConfigFinanceiro["rateioCustoFixo"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FATURAMENTO">Proporcional ao faturamento</SelectItem>
                      <SelectItem value="UNIDADE">Igual por unidade vendida</SelectItem>
                      <SelectItem value="NENHUM">Não ratear</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Custo fixo do envio Flex (R$, opcional)</Label>
                  <Input type="number" step="0.01" min="0" value={custoEnvioFlexInput} onChange={(e) => setCustoEnvioFlexInput(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={config.usarImpostoEstimado} onCheckedChange={(v) => setConfig({ ...config, usarImpostoEstimado: v })} />
                  <Label>Estimar imposto automaticamente nas vendas</Label>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={config.usarRelatorioLiberacaoMercadoPago} onCheckedChange={(v) => setConfig({ ...config, usarRelatorioLiberacaoMercadoPago: v })} />
                  <Label>Habilitar conferência de liberações do Mercado Pago</Label>
                </div>
              </div>
              <Button className="mt-4" disabled={salvandoConfig} onClick={salvarConfig}>
                {salvandoConfig ? "Salvando…" : "Salvar configurações"}
              </Button>
            </SectionCard>
          )}

          <SectionCard title="Importação de histórico">
            <p className="mb-3 text-sm text-muted-foreground">
              Importa pedidos antigos do Mercado Livre para o financeiro. Pode levar vários cliques para concluir — cada chamada processa um lote.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Dias de histórico</Label>
                <Input type="number" min="1" className="w-[140px]" value={diasImportar} onChange={(e) => setDiasImportar(e.target.value)} disabled={statusImportacao === "em_andamento"} />
              </div>
              <Button onClick={importarHistorico} disabled={statusImportacao === "em_andamento"}>
                {statusImportacao === "em_andamento" && <LucideLoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Importar histórico
              </Button>
              {statusImportacao !== "ocioso" && (
                <span className="text-sm text-muted-foreground">
                  {statusImportacao === "em_andamento" && `Processando… ${totalImportado} pedido(s) até agora.`}
                  {statusImportacao === "concluido" && `Concluído: ${totalImportado} pedido(s) processado(s).`}
                  {statusImportacao === "erro" && "Erro na importação — tente novamente."}
                </span>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Conciliação de fatura">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div>
                <Label>Mês de referência</Label>
                <Input type="month" value={mesConciliacao} onChange={(e) => setMesConciliacao(e.target.value)} />
              </div>
              <Button variant="outline" disabled={carregandoConciliacao} onClick={gerarConciliacao}>
                {carregandoConciliacao ? "Gerando…" : "Gerar relatório"}
              </Button>
              <Button variant="outline" disabled={carregandoCobrancas} onClick={carregarCobrancasNaoMapeadas}>
                {carregandoCobrancas ? "Carregando…" : "Ver cobranças não mapeadas"}
              </Button>
            </div>
            {relatorioConciliacao && (
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Tipo</DataTableHead>
                    <DataTableHead className="text-right">Nos pedidos</DataTableHead>
                    <DataTableHead className="text-right">Na fatura</DataTableHead>
                    <DataTableHead className="text-right">Diferença</DataTableHead>
                    <DataTableHead />
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {relatorioConciliacao.map((linha) => (
                    <DataTableRow key={linha.tipo}>
                      <DataTableCell>
                        {linha.tipo === "TARIFA_VENDA" ? "Tarifa de venda" : "Frete"}
                        {linha.alerta && <StatusPill tone="warning" className="ml-2">Divergência</StatusPill>}
                      </DataTableCell>
                      <DataTableCell numeric>{formatBRL(linha.totalPedidos)}</DataTableCell>
                      <DataTableCell numeric>{formatBRL(linha.totalFatura)}</DataTableCell>
                      <DataTableCell numeric emphasis={linha.alerta}>{formatBRL(linha.diferenca)}</DataTableCell>
                      <DataTableCell>
                        <Button size="sm" variant="outline" disabled={criandoAjusteTipo === linha.tipo} onClick={() => criarAjusteConciliacao(linha.tipo)}>
                          Criar ajuste
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
            {cobrancasNaoMapeadas && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Cobranças não mapeadas no mês</p>
                {cobrancasNaoMapeadas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma cobrança não mapeada neste mês.</p>
                ) : (
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHead>Tipo externo</DataTableHead>
                        <DataTableHead className="text-right">Quantidade</DataTableHead>
                        <DataTableHead className="text-right">Total</DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {cobrancasNaoMapeadas.map((linha) => (
                        <DataTableRow key={linha.tipoExterno}>
                          <DataTableCell>{linha.tipoExterno}</DataTableCell>
                          <DataTableCell numeric>{linha.quantidade}</DataTableCell>
                          <DataTableCell numeric>{formatBRL(linha.total)}</DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                )}
              </div>
            )}
          </SectionCard>

          {config?.usarRelatorioLiberacaoMercadoPago && (
            <SectionCard title="Conferência de liberações (Mercado Pago)">
              <p className="mb-3 text-sm text-muted-foreground">
                Só para conferência manual — este relatório nunca alimenta a DRE.
              </p>
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div>
                  <Label>Desde</Label>
                  <Input type="date" value={liberacaoDesde} onChange={(e) => setLiberacaoDesde(e.target.value)} />
                </div>
                <div>
                  <Label>Até</Label>
                  <Input type="date" value={liberacaoAte} onChange={(e) => setLiberacaoAte(e.target.value)} />
                </div>
                <Button variant="outline" disabled={carregandoLiberacoes} onClick={conferirLiberacoes}>
                  {carregandoLiberacoes ? "Conferindo…" : "Conferir"}
                </Button>
              </div>
              {liberacoes && (
                liberacoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma liberação encontrada no período.</p>
                ) : (
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHead>Referência</DataTableHead>
                        <DataTableHead>Data</DataTableHead>
                        <DataTableHead className="text-right">Valor</DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {liberacoes.map((liberacao, indice) => (
                        <DataTableRow key={`${liberacao.referenciaExterna}-${indice}`}>
                          <DataTableCell>{liberacao.referenciaExterna ?? "—"}</DataTableCell>
                          <DataTableCell>{new Date(liberacao.data).toLocaleDateString("pt-BR")}</DataTableCell>
                          <DataTableCell numeric>{formatBRL(liberacao.valor)}</DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                )
              )}
            </SectionCard>
          )}

          {papel === "ADMIN" && (
            <SectionCard title="Diagnóstico Mercado Livre">
              <p className="mb-3 text-sm text-muted-foreground">
                Consulta os dados crus de um pedido direto na API do Mercado Livre (sem dados pessoais do comprador) — só para depuração.
              </p>
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div>
                  <Label>Número do pedido</Label>
                  <Input value={pedidoDiagnostico} onChange={(e) => setPedidoDiagnostico(e.target.value)} className="w-[220px]" />
                </div>
                <Button variant="outline" disabled={carregandoDiagnostico} onClick={consultarDiagnostico}>
                  {carregandoDiagnostico ? "Consultando…" : "Consultar"}
                </Button>
              </div>
              {resultadoDiagnostico != null && (
                <pre className="max-h-[400px] overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(resultadoDiagnostico, null, 2)}
                </pre>
              )}
            </SectionCard>
          )}
        </>
      )}

      <Dialog open={dialogCategoriaAberto} onOpenChange={setDialogCategoriaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={formCategoria.nome} onChange={(e) => setFormCategoria({ ...formCategoria, nome: e.target.value })} />
            </div>
            <div>
              <Label>Grupo (DRE)</Label>
              <Select value={formCategoria.grupoDre} onValueChange={(v) => setFormCategoria({ ...formCategoria, grupoDre: v as GrupoDre })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTULO_GRUPO_DRE).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria principal (opcional)</Label>
              <Select value={formCategoria.paiId} onValueChange={(v) => setFormCategoria({ ...formCategoria, paiId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma — é uma categoria principal</SelectItem>
                  {categoriasRaiz.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={salvandoCategoria} onClick={criarCategoria}>{salvandoCategoria ? "Salvando…" : "Criar categoria"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogContaAberto} onOpenChange={setDialogContaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{contaEditando ? "Editar conta financeira" : "Nova conta financeira"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={formConta.nome} onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })} />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={formConta.tipo} onValueChange={(v) => setFormConta({ ...formConta, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULO_TIPO_CONTA).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Saldo inicial (R$)</Label>
                <Input type="number" step="0.01" value={formConta.saldoInicial} onChange={(e) => setFormConta({ ...formConta, saldoInicial: e.target.value })} />
              </div>
              <div>
                <Label>Data do saldo inicial</Label>
                <Input type="date" value={formConta.dataSaldoInicial} onChange={(e) => setFormConta({ ...formConta, dataSaldoInicial: e.target.value })} />
              </div>
            </div>
            {formConta.tipo === "CARTAO_CREDITO" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Dia de fechamento</Label>
                  <Input type="number" min="1" max="31" value={formConta.diaFechamento} onChange={(e) => setFormConta({ ...formConta, diaFechamento: e.target.value })} />
                </div>
                <div>
                  <Label>Dia de vencimento</Label>
                  <Input type="number" min="1" max="31" value={formConta.diaVencimento} onChange={(e) => setFormConta({ ...formConta, diaVencimento: e.target.value })} />
                </div>
                <div>
                  <Label>Limite (R$)</Label>
                  <Input type="number" step="0.01" value={formConta.limite} onChange={(e) => setFormConta({ ...formConta, limite: e.target.value })} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={salvandoConta} onClick={salvarConta}>{salvandoConta ? "Salvando…" : contaEditando ? "Salvar" : "Criar conta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
