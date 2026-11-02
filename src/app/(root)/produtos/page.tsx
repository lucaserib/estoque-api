"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Box,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Link2,
  MoreHorizontal,
  Package,
  PencilLine,
  PlusCircle,
  RefreshCw,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import ProdutoList, { type AbaProdutos } from "./components/ProdutoList";
import ProdutoFormModal from "./components/ProdutoFormModal";
import { ImportarDoBlingDialog } from "./components/ImportarDoBlingDialog";
import { ProdutoDeleteDialog } from "@/components/ProdutoDeleteDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SincronizacaoCatalogo } from "@/components/sincronizacao/SincronizacaoCatalogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProdutoParaExcluir {
  id: string;
  nome: string;
  vinculos?: { hasKits: boolean; hasEstoque: boolean; hasPedidos: boolean; hasSaidas: boolean };
}

interface BlingAccountStatus {
  id: string;
  isActive: boolean;
}

const classeAba =
  "gap-2 rounded-none border-b-2 border-transparent px-0 pb-3 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";

function ProdutosPageContent() {
  const [aba, setAba] = useState<AbaProdutos>("produtos");
  const [versao, setVersao] = useState(0);
  const [contagens, setContagens] = useState({ produtos: 0, kits: 0, inativos: 0 });
  const [cadastroManual, setCadastroManual] = useState(false);
  const [buscarNoBling, setBuscarNoBling] = useState(false);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState<ProdutoParaExcluir | null>(null);
  const [vinculosPendentes, setVinculosPendentes] = useState(0);
  const [blingConta, setBlingConta] = useState<BlingAccountStatus | null>(null);
  const [atualizandoVendas, setAtualizandoVendas] = useState(false);

  const recarregar = () => setVersao((v) => v + 1);
  const blingConectado = blingConta?.isActive ?? false;
  const blingExpirado = blingConta !== null && !blingConta.isActive;

  useEffect(() => {
    fetch("/api/bling/auth?action=accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((contas: BlingAccountStatus[]) => setBlingConta(contas.find((c) => c.isActive) ?? contas[0] ?? null))
      .catch(() => setBlingConta(null));
  }, []);

  useEffect(() => {
    fetch("/api/produtos/vinculos-pendentes")
      .then((r) => (r.ok ? r.json() : { vinculos: [] }))
      .then((body: { vinculos: unknown[] }) => setVinculosPendentes(body.vinculos.length))
      .catch(() => setVinculosPendentes(0));
  }, [versao]);

  const recalcularVendasMl = async () => {
    setAtualizandoVendas(true);
    try {
      const res = await fetch("/api/produtos/vendas-ml");
      if (res.status === 429) {
        toast.error("Muitas atualizações seguidas. Aguarde alguns minutos.");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Vendas atualizadas: ${data.totalPedidos} pedidos (${data.periodo.descricao}).`);
      if (data.parcial) toast.warning("Alguns pedidos não vieram do Mercado Livre — os números podem estar incompletos.");
      recarregar();
    } catch {
      toast.error("Erro ao atualizar vendas do Mercado Livre");
    } finally {
      setAtualizandoVendas(false);
    }
  };

  const reconectarBling = async () => {
    try {
      const res = await fetch("/api/bling/auth?action=connect");
      if (!res.ok) throw new Error();
      window.location.href = (await res.json()).authUrl;
    } catch {
      toast.error("Erro ao iniciar reconexão com o Bling");
    }
  };

  const excluirProduto = async (forcar: boolean) => {
    if (!produtoParaExcluir) return;
    try {
      const res = await fetch(`/api/produtos?id=${produtoParaExcluir.id}&forceDelete=${forcar}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        if (body.hasVinculos) {
          setProdutoParaExcluir({ ...produtoParaExcluir, vinculos: body.vinculos });
          return;
        }
        throw new Error(body.message);
      }
      toast.success("Produto excluído.");
      setProdutoParaExcluir(null);
      recarregar();
    } catch {
      toast.error("Não foi possível excluir o produto. Tente novamente.");
    }
  };

  return (
    <div className="container mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Produtos"
        subtitle={`${contagens.produtos} produtos · ${contagens.kits} kits ativos`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            {vinculosPendentes > 0 && (
              <Button asChild variant="outline" className="gap-2">
                <Link href="/produtos/vinculos-pendentes">
                  <Link2 className="h-4 w-4" />
                  Confirmar vínculos
                  <span className="rounded-full bg-warning px-2 py-0.5 text-xs text-warning-foreground">
                    {vinculosPendentes}
                  </span>
                </Link>
              </Button>
            )}
            <SincronizacaoCatalogo onConcluido={recarregar} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" aria-label="Mais ações">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">Mais</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem asChild>
                  <Link href="/produtos/importar-estoque" className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Importar estoque (planilha)
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/produtos/importar" className="gap-2">
                    <Download className="h-4 w-4" />
                    Importar produtos e custos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/mercado-livre/produtos" className="gap-2">
                    <Link2 className="h-4 w-4" />
                    Anúncios e vínculos do ML
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={atualizandoVendas} onSelect={recalcularVendasMl} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${atualizandoVendas ? "animate-spin" : ""}`} />
                  Recalcular vendas e Full do ML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Novo produto
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Como você quer cadastrar?
                </DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={!blingConectado}
                  onSelect={() => setBuscarNoBling(true)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Download className="h-4 w-4" />
                    Buscar no Bling
                  </span>
                  <span className="pl-6 text-xs text-muted-foreground">
                    {blingConectado ? "Traz nome, EAN, custo, fornecedor e foto" : "Conecte o Bling em Integrações"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCadastroManual(true)} className="flex-col items-start gap-0.5">
                  <span className="flex items-center gap-2 font-medium">
                    <PencilLine className="h-4 w-4" />
                    Cadastrar à mão
                  </span>
                  <span className="pl-6 text-xs text-muted-foreground">Produto simples ou kit de vários produtos</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {blingExpirado && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="flex flex-col items-start justify-between gap-4 pt-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning-text" />
              <div>
                <p className="font-semibold">Conexão com o Bling expirou</p>
                <p className="text-sm text-muted-foreground">
                  Reconecte para voltar a importar produtos e sincronizar estoque.
                </p>
              </div>
            </div>
            <Button onClick={reconectarBling}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconectar
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as AbaProdutos)}>
        <TabsList className="h-auto justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="produtos" className={classeAba}>
            <Package className="h-4 w-4" />
            Produtos
            <span className="text-xs">{contagens.produtos}</span>
          </TabsTrigger>
          <TabsTrigger value="kits" className={classeAba}>
            <Box className="h-4 w-4" />
            Kits
            <span className="text-xs">{contagens.kits}</span>
          </TabsTrigger>
          <TabsTrigger value="inativos" className={classeAba}>
            <Archive className="h-4 w-4" />
            Inativos
            <span className="text-xs">{contagens.inativos}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ProdutoList
        aba={aba}
        versao={versao}
        onDelete={(p) => setProdutoParaExcluir(p)}
        onContagens={setContagens}
      />

      {cadastroManual && (
        <ProdutoFormModal
          onClose={() => setCadastroManual(false)}
          onSave={(novo) => {
            toast.success(`${novo.isKit ? "Kit" : "Produto"} cadastrado`);
            recarregar();
          }}
        />
      )}

      <ImportarDoBlingDialog
        aberto={buscarNoBling}
        onFechar={() => setBuscarNoBling(false)}
        onImportado={recarregar}
        onCadastrarManual={() => {
          setBuscarNoBling(false);
          setCadastroManual(true);
        }}
      />

      {produtoParaExcluir && (
        <ProdutoDeleteDialog
          isOpen
          onClose={() => setProdutoParaExcluir(null)}
          produtoNome={produtoParaExcluir.nome}
          onConfirm={excluirProduto}
          hasVinculos={produtoParaExcluir.vinculos}
        />
      )}
    </div>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={null}>
      <ProdutosPageContent />
    </Suspense>
  );
}
