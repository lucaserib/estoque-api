"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Loader2,
  Package,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Warehouse,
  Trash2,
  LucideLoaderCircle,
  CalculatorIcon,
  ClockIcon,
  PencilIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Header from "@/app/components/Header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EstoqueDeleteDialog } from "@/components/EstoqueDeleteDialog";
import { toast } from "sonner";
import { exportToExcel, formatEstoqueForExport } from "@/utils/excelExport";
import { ExportButton } from "@/components/ExportButton";

interface Produto {
  id: string;
  nome: string;
  sku: string;
  custoMedio: number;
}

interface Estoque {
  id: string;
  produtoId: string;
  produto: Produto;
  quantidade: number;
  estoqueSeguranca: number;
}

interface Armazem {
  id: string;
  nome: string;
}

const EstoquePage = () => {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [estoque, setEstoque] = useState<Estoque[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState<string | null>(null);
  const [novoArmazem, setNovoArmazem] = useState("");
  const [estoqueSeguranca, setEstoqueSeguranca] = useState<number | null>(null);
  const [quantidadeProduto, setQuantidadeProduto] = useState<number | null>(
    null
  );
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Estoque | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewWarehouseOpen, setIsNewWarehouseOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [estoqueToDelete, setEstoqueToDelete] = useState<{
    produtoId: string;
    produtoNome: string;
    armazemNome: string;
  } | null>(null);
  const [estoqueSegurancaMode, setEstoqueSegurancaMode] = useState<
    "manual" | "auto"
  >("manual");
  const [tempoReposicao, setTempoReposicao] = useState<number>(7); // Padrão: 7 dias
  const [calculandoEstoqueSeguranca, setCalculandoEstoqueSeguranca] =
    useState(false);
  const [mediaConsumoDiario, setMediaConsumoDiario] = useState<number | null>(
    null
  );

  const fetchArmazens = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/estoque/criarArmazem");
      const data = await response.json();
      setArmazens(data);

      // If there's no active warehouse set and we have data, set the first one active
      if (data.length > 0 && !activeWarehouse) {
        setActiveWarehouse(data[0].id);
      }
    } catch (error) {
      console.error("Erro ao buscar armazéns:", error);
      setErrorMessage(
        "Não foi possível carregar os armazéns. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    activeWarehouse,
    setArmazens,
    setActiveWarehouse,
    setIsLoading,
    setErrorMessage,
  ]);

  useEffect(() => {
    fetchArmazens();
  }, [refreshTrigger, fetchArmazens]);

  useEffect(() => {
    if (activeWarehouse) fetchEstoque(activeWarehouse);
  }, [activeWarehouse, refreshTrigger]);

  const calcularEstoqueSeguranca = async (produtoId: string) => {
    setCalculandoEstoqueSeguranca(true);
    try {
      const response = await fetch(
        `/api/produtos/consumo-diario?produtoId=${produtoId}&armazemId=${activeWarehouse}`
      );

      if (!response.ok) {
        throw new Error("Erro ao calcular consumo diário");
      }

      const data = await response.json();
      const mediaDiaria = data.mediaDiaria || 0;

      setMediaConsumoDiario(mediaDiaria);

      const estoqueSegurancaCalculado = Math.ceil(mediaDiaria * tempoReposicao);

      setEstoqueSeguranca(estoqueSegurancaCalculado);
    } catch (error) {
      console.error("Erro ao calcular estoque de segurança:", error);
      toast.error("Não foi possível calcular o estoque de segurança");
    } finally {
      setCalculandoEstoqueSeguranca(false);
    }
  };

  const handleExportEstoque = (armazemId: string, armazemNome: string) => {
    if (!estoque || estoque.length === 0) {
      toast.error("Não há dados de estoque para exportar");
      return;
    }

    try {
      const formattedData = formatEstoqueForExport(estoque);
      exportToExcel(
        formattedData,
        `estoque_${armazemNome.replace(/\s+/g, "_")}`,
        armazemNome
      );
      toast.success("Exportação concluída com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar dados");
      console.error(error);
    }
  };

  const fetchEstoque = async (armazemId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/estoque/${armazemId}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        setEstoque(data);
      } else {
        console.error("API retornou dados não esperados:", data);
        setEstoque([]);
        setErrorMessage(
          "Formato de dados inesperado. Por favor, contate o suporte."
        );
      }
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
      setEstoque([]);
      setErrorMessage("Não foi possível carregar o estoque. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCriarArmazem = async () => {
    if (!novoArmazem.trim()) {
      setErrorMessage("O nome do armazém é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/estoque/criarArmazem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoArmazem }),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar armazém");
      }

      setNovoArmazem("");
      setIsNewWarehouseOpen(false);
      setSuccessMessage("Armazém criado com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Erro ao criar armazém:", error);
      setErrorMessage("Não foi possível criar o armazém. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAtualizarEstoque = async (produtoId: string) => {
    if (!activeWarehouse) return;

    try {
      setIsSaving(true);

      // Comentado temporariamente: Atualização direta de quantidade no estoque
      /* 
      if (quantidadeProduto !== null) {
        console.log(
          "Enviando atualização com armazemId:",
          activeWarehouse,
          "tipo:",
          typeof activeWarehouse
        );
        const response = await fetch("/api/estoque/armazens", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId,
            armazemId: activeWarehouse,
            quantidade: quantidadeProduto,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error response:", errorData);
          throw new Error(errorData.message || "Erro ao atualizar quantidade");
        }
      }
      */

      if (estoqueSeguranca !== null) {
        const estoqueSegurancaNumber = Number(estoqueSeguranca);

        console.log("Enviando estoque de segurança:", {
          produtoId,
          armazemId: activeWarehouse,
          estoqueSeguranca: estoqueSegurancaNumber,
          tipo: typeof estoqueSegurancaNumber,
        });

        const response = await fetch(`/api/estoque/estoqueSeguranca`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId,
            armazemId: activeWarehouse,
            estoqueSeguranca: estoqueSegurancaNumber,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error response:", errorData);
          throw new Error(
            errorData.message || "Erro ao atualizar estoque de segurança"
          );
        }
      }

      setEstoque((prev) =>
        prev.map((item) =>
          item.produto.id === produtoId
            ? {
                ...item,
                // Mantém a quantidade atual em vez de usar o valor editado
                quantidade: item.quantidade,
                estoqueSeguranca: estoqueSeguranca ?? item.estoqueSeguranca,
              }
            : item
        )
      );

      setProdutoEmEdicao(null);
      setQuantidadeProduto(null);
      setEstoqueSeguranca(null);
      setIsModalOpen(false);
      setSuccessMessage("Estoque de segurança atualizado com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Erro ao atualizar estoque:", error);
      setErrorMessage("Não foi possível atualizar o estoque. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditarProduto = (produto: Estoque) => {
    setProdutoEmEdicao(produto);
    setQuantidadeProduto(produto.quantidade);
    setEstoqueSeguranca(produto.estoqueSeguranca);
    setIsModalOpen(true);
  };

  const handleDeleteWarehouse = async (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir este armazém? Todos os dados de estoque associados serão perdidos."
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/estoque/armazens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ armazemId: id }),
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir armazém");
      }

      setSuccessMessage("Armazém excluído com sucesso!");
      setTimeout(() => setSuccessMessage(""), 3000);

      setArmazens(armazens.filter((armazem) => armazem.id !== id));

      if (activeWarehouse === id) {
        setActiveWarehouse(armazens.length > 1 ? armazens[0].id : null);
      }
    } catch (error) {
      console.error("Erro ao excluir armazém:", error);
      setErrorMessage("Não foi possível excluir o armazém. Tente novamente.");
    }
  };

  const handleDeleteEstoque = async () => {
    if (!estoqueToDelete || !activeWarehouse) return;

    try {
      const response = await fetch(
        `/api/estoque?produtoId=${estoqueToDelete.produtoId}&armazemId=${activeWarehouse}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.hasVinculos) {
          toast.error(
            "Não é possível excluir o estoque pois existem saídas registradas"
          );
          return;
        }
        throw new Error(errorData.message || "Erro ao excluir estoque");
      }

      setEstoque((prev) =>
        prev.filter((item) => item.produto.id !== estoqueToDelete.produtoId)
      );
      toast.success("Estoque excluído com sucesso!");
      setEstoqueToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir estoque:", error);
      toast.error("Não foi possível excluir o estoque. Tente novamente.");
    }
  };

  const filteredEstoque = Array.isArray(estoque)
    ? estoque.filter(
        (item) =>
          item.produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Header name="Gestão de Estoque" />
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gerencie seu estoque por armazém e monitore níveis de produtos
            </p>
          </div>
          <Button
            onClick={() => setIsNewWarehouseOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-700 dark:hover:bg-indigo-600 gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Novo Armazém
          </Button>
        </div>
      </div>

      {successMessage && (
        <Alert variant="success" className="animate-fade-in">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive" className="animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="ml-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </Alert>
      )}

      {isLoading && armazens.length === 0 ? (
        <div className="container max-w-6xl mx-auto p-6">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex items-center gap-2">
              <LucideLoaderCircle className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">
                Carregando Armazéns...
              </span>
            </div>
          </div>
        </div>
      ) : armazens.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Warehouse className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nenhum armazém cadastrado
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
              Crie seu primeiro armazém para começar a gerenciar seu estoque
            </p>
            <Button
              onClick={() => setIsNewWarehouseOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Criar Armazém
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Armazéns</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Tabs
                value={activeWarehouse || ""}
                onValueChange={setActiveWarehouse}
                className="w-full"
              >
                <TabsList className="mb-4 w-full h-auto flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-md">
                  {armazens.map((armazem) => (
                    <TabsTrigger
                      key={armazem.id}
                      value={armazem.id}
                      className="flex-shrink-0 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 px-4 py-2 group"
                    >
                      <Warehouse className="w-4 h-4 mr-2" />
                      {armazem.nome}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWarehouse(armazem.id);
                        }}
                        className="ml-2 inline-flex h-6 w-6 items-center justify-center p-0 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 cursor-pointer"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar produto por nome ou SKU..."
                    className="pl-9 bg-white dark:bg-gray-800"
                  />
                </div>

                {armazens.map((armazem) => (
                  <TabsContent
                    key={armazem.id}
                    value={armazem.id}
                    className="mt-0"
                  >
                    <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
                      <CardHeader className="bg-gray-50 dark:bg-gray-800/50 pb-2 flex flex-row justify-between items-center">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          <Warehouse className="h-5 w-5 text-indigo-500" />
                          Estoque: {armazem.nome}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <ExportButton
                            onClick={() =>
                              handleExportEstoque(armazem.id, armazem.nome)
                            }
                            label="Exportar Excel"
                          />
                          <Button
                            onClick={() =>
                              setRefreshTrigger((prev) => prev + 1)
                            }
                            variant="outline"
                            size="sm"
                            className="h-8"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            Atualizar
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {isLoading && activeWarehouse === armazem.id ? (
                          <div className="flex justify-center items-center py-12">
                            <LucideLoaderCircle className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        ) : (
                          <Table>
                            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                              <TableRow>
                                <TableHead className="font-medium">
                                  Produto
                                </TableHead>
                                <TableHead className="font-medium">
                                  SKU
                                </TableHead>
                                <TableHead className="font-medium text-center">
                                  Quantidade
                                </TableHead>
                                <TableHead className="font-medium text-center">
                                  Est. Segurança
                                </TableHead>
                                <TableHead className="font-medium text-center">
                                  Status
                                </TableHead>
                                <TableHead className="font-medium text-right">
                                  Ações
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredEstoque.length > 0 ? (
                                filteredEstoque.map((item) => {
                                  const isLowStock =
                                    item.quantidade <= item.estoqueSeguranca;
                                  const isOutOfStock = item.quantidade === 0;

                                  return (
                                    <TableRow
                                      key={item.produto.id}
                                      className="group hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                      <TableCell className="font-medium">
                                        {item.produto.nome}
                                      </TableCell>
                                      <TableCell className="text-gray-600 dark:text-gray-300">
                                        {item.produto.sku}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          variant={
                                            isOutOfStock
                                              ? "destructive"
                                              : isLowStock
                                              ? "warning"
                                              : "success"
                                          }
                                          className="justify-center min-w-10"
                                        >
                                          {item.quantidade}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          variant="outline"
                                          className="justify-center min-w-10"
                                        >
                                          {item.estoqueSeguranca}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {isOutOfStock ? (
                                          <Badge variant="destructive">
                                            Esgotado
                                          </Badge>
                                        ) : isLowStock ? (
                                          <Badge variant="warning">Baixo</Badge>
                                        ) : (
                                          <Badge variant="success">
                                            Normal
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleEditarProduto(item)
                                            }
                                            className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                                          >
                                            <Settings className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              setEstoqueToDelete({
                                                produtoId: item.produto.id,
                                                produtoNome: item.produto.nome,
                                                armazemNome: armazem.nome,
                                              })
                                            }
                                            className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              ) : activeWarehouse === armazem.id &&
                                !isLoading ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={6}
                                    className="text-center py-8 text-gray-500 dark:text-gray-400"
                                  >
                                    {searchTerm
                                      ? "Nenhum produto encontrado com os critérios de busca."
                                      : "Nenhum produto cadastrado neste armazém."}
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>Atualizar Estoque de Segurança</DialogTitle>
          </DialogHeader>
          {produtoEmEdicao && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md mb-2">
                <h3 className="font-medium">{produtoEmEdicao.produto.nome}</h3>
                <p className="text-sm text-gray-500">
                  SKU: {produtoEmEdicao.produto.sku}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="quantidade" className="text-sm font-medium">
                  Quantidade
                </label>
                <Input
                  id="quantidade"
                  type="number"
                  value={quantidadeProduto ?? ""}
                  onChange={(e) =>
                    setQuantidadeProduto(parseInt(e.target.value) || 0)
                  }
                  min={0}
                  disabled={true}
                />
                <p className="text-xs text-gray-500 text-amber-600">
                  A edição direta de quantidade no estoque está temporariamente
                  desabilitada.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="estoqueSeguranca"
                  className="text-sm font-medium"
                >
                  Estoque de Segurança
                </label>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Tabs
                      value={estoqueSegurancaMode}
                      onValueChange={(v) =>
                        setEstoqueSegurancaMode(v as "manual" | "auto")
                      }
                    >
                      <TabsList>
                        <TabsTrigger
                          value="manual"
                          className="flex items-center gap-1"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Manual
                        </TabsTrigger>
                        <TabsTrigger
                          value="auto"
                          className="flex items-center gap-1"
                        >
                          <CalculatorIcon className="h-3.5 w-3.5" />
                          Automático
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="manual">
                        <Input
                          id="estoqueSeguranca"
                          type="number"
                          value={estoqueSeguranca ?? ""}
                          onChange={(e) =>
                            setEstoqueSeguranca(parseInt(e.target.value) || 0)
                          }
                          min={0}
                          className="w-full"
                        />
                      </TabsContent>
                      <TabsContent value="auto">
                        <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                          <div className="space-y-2">
                            <label
                              htmlFor="tempoReposicao"
                              className="text-sm font-medium flex items-center gap-1"
                            >
                              <ClockIcon className="h-3.5 w-3.5 text-blue-600" />
                              Tempo médio de reposição (dias)
                            </label>
                            <Input
                              id="tempoReposicao"
                              type="number"
                              value={tempoReposicao}
                              onChange={(e) =>
                                setTempoReposicao(parseInt(e.target.value) || 7)
                              }
                              min={1}
                              className="w-full"
                            />
                          </div>

                          <Button
                            onClick={() =>
                              calcularEstoqueSeguranca(
                                produtoEmEdicao.produto.id
                              )
                            }
                            disabled={calculandoEstoqueSeguranca}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            {calculandoEstoqueSeguranca ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                Calculando...
                              </>
                            ) : (
                              <>
                                <CalculatorIcon className="h-3.5 w-3.5 mr-2" />
                                Calcular Estoque de Segurança
                              </>
                            )}
                          </Button>

                          {mediaConsumoDiario !== null && (
                            <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                              <p className="font-medium">Dados para cálculo:</p>
                              <ul className="list-disc pl-4 mt-1 space-y-1">
                                <li>
                                  Consumo médio diário:{" "}
                                  {mediaConsumoDiario.toFixed(2)} unidades/dia
                                </li>
                                <li>
                                  Tempo de reposição: {tempoReposicao} dias
                                </li>
                                <li>
                                  Estoque de segurança calculado:{" "}
                                  {estoqueSeguranca} unidades
                                </li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <p className="text-xs text-gray-500">
                    Nível mínimo recomendado antes de reposição
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                produtoEmEdicao &&
                handleAtualizarEstoque(produtoEmEdicao.produto.id)
              }
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewWarehouseOpen} onOpenChange={setIsNewWarehouseOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>Novo Armazém</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="nomeArmazem" className="text-sm font-medium">
                Nome do Armazém
              </label>
              <Input
                id="nomeArmazem"
                value={novoArmazem}
                onChange={(e) => setNovoArmazem(e.target.value)}
                placeholder="Ex: Depósito Central"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsNewWarehouseOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriarArmazem}
              disabled={isSaving || !novoArmazem.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Armazém"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      {estoqueToDelete && (
        <EstoqueDeleteDialog
          isOpen={!!estoqueToDelete}
          onClose={() => setEstoqueToDelete(null)}
          produtoNome={estoqueToDelete.produtoNome}
          armazemNome={estoqueToDelete.armazemNome}
          onConfirm={handleDeleteEstoque}
        />
      )}
    </div>
  );
};

export default EstoquePage;
