"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftRight,
  Package,
  Warehouse,
  Plus,
  Minus,
  Send,
  Search,
  Calendar,
  FileText,
  Loader2,
} from "lucide-react";
import Header from "@/app/components/Header";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Produto {
  id: string;
  nome: string;
  sku: string;
}

interface EstoqueProduto {
  produtoId: string;
  produto: Produto;
  quantidade: number;
}

interface Armazem {
  id: string;
  nome: string;
}

interface TransferenciaItem {
  produtoId: string;
  quantidade: number;
  produto?: Produto;
}

interface Transferencia {
  id: string;
  data: string;
  armazemOrigem: Armazem;
  armazemDestino: Armazem;
  observacoes?: string;
  status: string;
  itens: Array<{
    produto: Produto;
    quantidade: number;
  }>;
}

const TransferenciasPage = () => {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [estoqueOrigem, setEstoqueOrigem] = useState<EstoqueProduto[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [armazemOrigemId, setArmazemOrigemId] = useState<string>("");
  const [armazemDestinoId, setArmazemDestinoId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItens, setSelectedItens] = useState<TransferenciaItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchArmazens();
    fetchTransferencias();
  }, []);

  useEffect(() => {
    if (armazemOrigemId) {
      fetchEstoqueOrigem(armazemOrigemId);
    } else {
      setEstoqueOrigem([]);
    }
  }, [armazemOrigemId]);

  const fetchArmazens = async () => {
    try {
      const response = await fetch("/api/estoque/criarArmazem");
      const data = await response.json();
      setArmazens(data);
    } catch (error) {
      console.error("Erro ao buscar armazéns:", error);
      toast.error("Erro ao carregar armazéns");
    }
  };

  const fetchEstoqueOrigem = async (armazemId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/estoque/${armazemId}`);
      const data = await response.json();
      setEstoqueOrigem(data || []);
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
      toast.error("Erro ao carregar estoque");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransferencias = async () => {
    try {
      const response = await fetch("/api/transferencias");
      const data = await response.json();
      setTransferencias(data || []);
    } catch (error) {
      console.error("Erro ao buscar transferências:", error);
      toast.error("Erro ao carregar transferências");
    }
  };

  const handleSelectProduto = (estoqueProduto: EstoqueProduto, checked: boolean) => {
    if (checked) {
      setSelectedItens((prev) => [
        ...prev,
        {
          produtoId: estoqueProduto.produtoId,
          quantidade: 1,
          produto: estoqueProduto.produto,
        },
      ]);
    } else {
      setSelectedItens((prev) =>
        prev.filter((item) => item.produtoId !== estoqueProduto.produtoId)
      );
    }
  };

  const updateQuantidade = (produtoId: string, quantidade: number) => {
    setSelectedItens((prev) =>
      prev.map((item) =>
        item.produtoId === produtoId ? { ...item, quantidade } : item
      )
    );
  };

  const getMaxQuantidade = (produtoId: string) => {
    const estoque = estoqueOrigem.find((e) => e.produtoId === produtoId);
    return estoque?.quantidade || 0;
  };

  const handleRealizarTransferencia = async () => {
    if (!armazemOrigemId || !armazemDestinoId) {
      toast.error("Selecione armazém de origem e destino");
      return;
    }

    if (selectedItens.length === 0) {
      toast.error("Selecione pelo menos um produto para transferir");
      return;
    }

    const itensValidos = selectedItens.filter((item) => item.quantidade > 0);
    if (itensValidos.length === 0) {
      toast.error("Informe quantidades válidas para os produtos");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          armazemOrigemId,
          armazemDestinoId,
          observacoes,
          itens: itensValidos.map((item) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao realizar transferência");
      }

      toast.success("Transferência realizada com sucesso!");
      setIsDialogOpen(false);
      resetForm();
      fetchTransferencias();
      if (armazemOrigemId) {
        fetchEstoqueOrigem(armazemOrigemId);
      }
    } catch (error) {
      console.error("Erro ao realizar transferência:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao realizar transferência");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setArmazemOrigemId("");
    setArmazemDestinoId("");
    setObservacoes("");
    setSelectedItens([]);
    setSearchTerm("");
  };

  const filteredEstoque = estoqueOrigem.filter(
    (item) =>
      item.produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const countTotalItens = (transferencia: Transferencia) => {
    return transferencia.itens.reduce((acc, item) => acc + item.quantidade, 0);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Header name="Transferência de Estoque" />
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Transfira produtos entre armazéns de forma simples e segura
            </p>
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-700 dark:hover:bg-indigo-600 gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Nova Transferência
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Histórico de Transferências
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transferencias.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-dashed border-gray-300 dark:border-gray-700">
              <ArrowLeftRight className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
                Nenhuma transferência registrada
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Não há transferências cadastradas. Use o botão &quot;Nova Transferência&quot; para começar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferencias.map((transferencia) => (
                  <TableRow key={transferencia.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {format(new Date(transferencia.data), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-gray-400" />
                        {transferencia.armazemOrigem.nome}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-gray-400" />
                        {transferencia.armazemDestino.nome}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {countTotalItens(transferencia)} itens
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transferencia.observacoes ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm truncate max-w-40">
                            {transferencia.observacoes}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">Concluída</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Nova Transferência de Estoque
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Armazém de Origem</label>
              <Select value={armazemOrigemId} onValueChange={setArmazemOrigemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o armazém de origem" />
                </SelectTrigger>
                <SelectContent>
                  {armazens.map((armazem) => (
                    <SelectItem key={armazem.id} value={armazem.id}>
                      {armazem.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Armazém de Destino</label>
              <Select value={armazemDestinoId} onValueChange={setArmazemDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o armazém de destino" />
                </SelectTrigger>
                <SelectContent>
                  {armazens
                    .filter((a) => a.id !== armazemOrigemId)
                    .map((armazem) => (
                      <SelectItem key={armazem.id} value={armazem.id}>
                        {armazem.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {armazemOrigemId && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar produto por nome ou SKU..."
                  className="pl-9"
                />
              </div>

              <div className="border rounded-md max-h-80 overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Disponível</TableHead>
                        <TableHead>Quantidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEstoque.map((estoque) => {
                        const isSelected = selectedItens.some(
                          (item) => item.produtoId === estoque.produtoId
                        );
                        const selectedItem = selectedItens.find(
                          (item) => item.produtoId === estoque.produtoId
                        );

                        return (
                          <TableRow key={estoque.produtoId}>
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleSelectProduto(estoque, checked as boolean)
                                }
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {estoque.produto.nome}
                            </TableCell>
                            <TableCell>{estoque.produto.sku}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{estoque.quantidade}</Badge>
                            </TableCell>
                            <TableCell>
                              {isSelected && selectedItem ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      updateQuantidade(
                                        estoque.produtoId,
                                        Math.max(1, selectedItem.quantidade - 1)
                                      )
                                    }
                                    disabled={selectedItem.quantidade <= 1}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <Input
                                    type="number"
                                    value={selectedItem.quantidade}
                                    onChange={(e) =>
                                      updateQuantidade(
                                        estoque.produtoId,
                                        Math.min(
                                          getMaxQuantidade(estoque.produtoId),
                                          Math.max(1, parseInt(e.target.value) || 1)
                                        )
                                      )
                                    }
                                    min={1}
                                    max={getMaxQuantidade(estoque.produtoId)}
                                    className="w-20 text-center"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      updateQuantidade(
                                        estoque.produtoId,
                                        Math.min(
                                          getMaxQuantidade(estoque.produtoId),
                                          selectedItem.quantidade + 1
                                        )
                                      )
                                    }
                                    disabled={
                                      selectedItem.quantidade >=
                                      getMaxQuantidade(estoque.produtoId)
                                    }
                                    className="h-8 w-8 p-0"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {selectedItens.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                  <h4 className="font-medium mb-2">Resumo da Transferência</h4>
                  <div className="space-y-1 text-sm">
                    {selectedItens.map((item) => (
                      <div key={item.produtoId} className="flex justify-between">
                        <span>{item.produto?.nome}</span>
                        <span className="font-medium">{item.quantidade} unidades</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">Observações (opcional)</label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione observações sobre esta transferência..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRealizarTransferencia}
              disabled={
                isSaving ||
                !armazemOrigemId ||
                !armazemDestinoId ||
                selectedItens.length === 0
              }
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Realizar Transferência
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransferenciasPage;