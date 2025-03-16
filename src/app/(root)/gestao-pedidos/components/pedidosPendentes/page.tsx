"use client";
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pedido, PedidoProduto, Armazem } from "../../types";
import { useFetch } from "../../../../hooks/useFetch";
import { brlToCents, formatBRL } from "@/utils/currency";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

// Icons
import { Check, ChevronDown, Loader2, RefreshCw, X } from "lucide-react";
import { FaEdit, FaTrash } from "react-icons/fa";

const PedidosPendentes = () => {
  // Estado para controlar a atualização dos dados
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Buscar pedidos pendentes
  const {
    data: pedidos,
    loading: pedidosLoading,
    error: pedidosError,
    refetch: refetchPedidos,
  } = useFetch<Pedido>(
    "/api/pedidos-compra",
    (data) => data.filter((pedido) => pedido.status === "pendente"),
    [refreshTrigger]
  );

  // Buscar armazéns
  const {
    data: armazens,
    loading: armazensLoading,
    error: armazensError,
  } = useFetch<Armazem>("/api/estoque/criarArmazem");

  const [filteredPedidos, setFilteredPedidos] = useState<Pedido[]>([]);
  const [editPedido, setEditPedido] = useState<Pedido | null>(null);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingPedidoId, setDeletingPedidoId] = useState<number | null>(null);

  // Atualizar pedidos filtrados quando os pedidos mudarem
  useEffect(() => {
    if (pedidos) {
      console.log("Pedidos pendentes recebidos:", pedidos.length);
      setFilteredPedidos(pedidos);
    }
  }, [pedidos]);

  // Forçar atualização dos dados
  const refreshData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
    setSuccessMessage("");
    setError("");
    setEditPedido(null);
    setArmazemId(null);
  }, []);

  // Limpar mensagens após um tempo
  useEffect(() => {
    if (successMessage || error) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, error]);

  // Filtrar pedidos com base na pesquisa
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearch(value);

    if (!pedidos) return;

    const lowerCaseSearch = value.toLowerCase();
    setFilteredPedidos(
      pedidos.filter(
        (pedido) =>
          pedido.fornecedor.nome.toLowerCase().includes(lowerCaseSearch) ||
          pedido.id.toString().includes(lowerCaseSearch) ||
          pedido.produtos.some(
            (produto) =>
              produto.produto?.sku.toLowerCase().includes(lowerCaseSearch) ||
              produto.produto?.nome.toLowerCase().includes(lowerCaseSearch)
          )
      )
    );
  };

  const handleConfirm = async (id: number) => {
    if (!armazemId) {
      setError("Selecione um armazém para confirmar o pedido");
      return;
    }

    const pedidoParaConfirmar = pedidos?.find((pedido) => pedido.id === id);
    if (!pedidoParaConfirmar) {
      setError("Pedido não encontrado");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: id,
          armazemId,
          produtosRecebidos: pedidoParaConfirmar.produtos.map((p) => ({
            produtoId: p.produtoId,
            quantidade: p.quantidade,
            custo: p.custo,
            multiplicador: p.multiplicador || p.produto?.multiplicador || 1,
          })),
          comentarios: pedidoParaConfirmar.comentarios,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`Pedido #${id} confirmado com sucesso!`);

        if (data.novoPedidoId) {
          setSuccessMessage(
            (prev) =>
              `${prev} Um novo pedido #${data.novoPedidoId} foi criado para os itens não recebidos.`
          );
        }

        refreshData();
        setEditPedido(null);
        setArmazemId(null);
      } else {
        setError(data.error || "Erro ao confirmar pedido");
      }
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      setError("Erro ao confirmar pedido. Verifique sua conexão de internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (pedido: Pedido) => {
    // Cria uma cópia profunda do pedido para edição
    setEditPedido(JSON.parse(JSON.stringify(pedido)));
    setArmazemId(null);
    setError("");
  };

  const handleSave = async () => {
    if (!editPedido || !armazemId) {
      setError("Selecione um armazém para salvar o pedido");
      return;
    }

    // Validar quantidades
    const invalidProducts = editPedido.produtos.filter((p) => p.quantidade < 0);
    if (invalidProducts.length > 0) {
      setError(
        "Todos os produtos devem ter quantidade igual ou maior que zero"
      );
      return;
    }

    setIsSubmitting(true);

    const produtosRecebidos = editPedido.produtos.map((produto) => ({
      produtoId: produto.produtoId,
      quantidade: produto.quantidade,
      custo:
        typeof produto.custo === "number"
          ? produto.custo
          : brlToCents(produto.custo),
      multiplicador:
        produto.multiplicador || produto.produto?.multiplicador || 1,
    }));

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: editPedido.id,
          armazemId,
          produtosRecebidos,
          comentarios: editPedido.comentarios,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`Pedido #${editPedido.id} confirmado com sucesso!`);

        // Se um novo pedido foi criado para itens faltantes, mostrar isso na mensagem
        if (data.novoPedidoId) {
          setSuccessMessage(
            (prev) =>
              `${prev} Um novo pedido #${data.novoPedidoId} foi criado para os itens não recebidos.`
          );
        }

        refreshData(); // Atualizar a lista de pedidos
        setEditPedido(null);
        setArmazemId(null);
      } else {
        setError(data.error || "Erro ao salvar alterações");
      }
    } catch (error) {
      console.error("Erro ao salvar alterações:", error);
      setError("Erro ao salvar alterações. Verifique sua conexão de internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o pedido #${id}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setDeletingPedidoId(id);
    setError("");

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: id }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`Pedido #${id} excluído com sucesso!`);
        refreshData(); // Atualizar a lista de pedidos
      } else {
        setError(data.error || "Erro ao deletar pedido");
      }
    } catch (error) {
      console.error("Erro ao deletar pedido:", error);
      setError("Erro ao deletar pedido. Verifique sua conexão de internet.");
    } finally {
      setDeletingPedidoId(null);
    }
  };

  const handleProdutoChange = (
    produtoId: string,
    field: keyof PedidoProduto,
    value: number
  ) => {
    if (!editPedido) return;
    const updatedProdutos = editPedido.produtos.map((produto) =>
      produto.produtoId === produtoId ? { ...produto, [field]: value } : produto
    );
    setEditPedido({ ...editPedido, produtos: updatedProdutos });
  };

  const calcularValorTotalPedido = (pedido: Pedido) =>
    pedido.produtos.reduce((subtotal, produto) => {
      const quantidade = produto.quantidade;
      const custo =
        typeof produto.custo === "number"
          ? produto.custo
          : parseInt(produto.custo);
      const multiplicador =
        produto.multiplicador || produto.produto?.multiplicador || 1;
      return subtotal + quantidade * custo * multiplicador;
    }, 0);

  const calcularValorTotal = () =>
    filteredPedidos.reduce(
      (total, pedido) => total + calcularValorTotalPedido(pedido),
      0
    );

  const loading = pedidosLoading || armazensLoading;
  const systemError = pedidosError || armazensError;

  // Mostrar o carregamento
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="ml-2 text-gray-500 dark:text-gray-400">
          Carregando pedidos pendentes...
        </p>
      </div>
    );
  }

  // Mostrar erro do sistema (não o erro de operação)
  if (systemError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
        <p className="text-red-500 text-center">{systemError}</p>
        <button
          onClick={refreshData}
          className="mt-2 mx-auto block px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-6">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
          Pedidos Pendentes ({filteredPedidos.length})
        </h2>
        <Button
          onClick={refreshData}
          variant="outline"
          size="sm"
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      {/* Mensagens de sucesso ou erro */}
      {successMessage && (
        <Alert variant="success" className="mb-4">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Pesquisar por fornecedor, ID ou produto"
        className="mb-6"
      />

      {pedidos?.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-8 rounded-lg text-center">
          <h3 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Nenhum pedido pendente
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Crie um novo pedido de compra para começar.
          </p>
        </div>
      ) : filteredPedidos.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-6 rounded-lg text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum pedido encontrado com os critérios de pesquisa.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredPedidos.map((pedido) => (
            <Card key={pedido.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Pedido #{pedido.id}</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleEdit(pedido)}
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 bg-blue-500 hover:bg-blue-600 text-white border-none"
                      disabled={isSubmitting || deletingPedidoId === pedido.id}
                      title="Editar e confirmar pedido"
                    >
                      <FaEdit size={12} />
                    </Button>
                    <Button
                      onClick={() => handleDelete(pedido.id)}
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 bg-red-500 hover:bg-red-600 text-white border-none"
                      disabled={isSubmitting || deletingPedidoId === pedido.id}
                      title="Excluir pedido"
                    >
                      {deletingPedidoId === pedido.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FaTrash size={12} />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Fornecedor:</span>{" "}
                    {pedido.fornecedor.nome}
                  </p>
                  <p>
                    <span className="font-medium">Comentários:</span>{" "}
                    {pedido.comentarios || "Nenhum"}
                  </p>
                  {pedido.dataPrevista && (
                    <p>
                      <span className="font-medium">Data Prevista:</span>{" "}
                      {format(new Date(pedido.dataPrevista), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                  <p className="font-medium">
                    Valor Total: {formatBRL(calcularValorTotalPedido(pedido))}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-medium">
                    Produtos:
                  </p>
                  <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {pedido.produtos.slice(0, 3).map((produto) => (
                      <li key={produto.produtoId}>
                        {produto.produto?.sku}: {produto.quantidade} un. ×{" "}
                        {formatBRL(produto.custo)} ={" "}
                        {formatBRL(produto.quantidade * produto.custo)}
                      </li>
                    ))}
                    {pedido.produtos.length > 3 && (
                      <li className="italic">
                        + {pedido.produtos.length - 3} outros produtos...
                      </li>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editPedido && (
        <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-inner">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <FaEdit className="mr-2 text-indigo-500" />
              Editar e Confirmar Pedido #{editPedido.id}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditPedido(null)}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Comentários</label>
              <Textarea
                value={editPedido.comentarios || ""}
                onChange={(e) =>
                  setEditPedido({ ...editPedido, comentarios: e.target.value })
                }
                placeholder="Comentários sobre o recebimento..."
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Armazém Destino <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Select
                  value={armazemId || ""}
                  onValueChange={(value) => setArmazemId(value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um armazém" />
                  </SelectTrigger>
                  <SelectContent>
                    {armazens?.map((armazem) => (
                      <SelectItem
                        key={armazem.id}
                        value={armazem.id.toString()}
                      >
                        {armazem.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!armazemId && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Você precisa selecionar um armazém para confirmar o pedido
                </p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Produtos Recebidos</h4>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Se recebeu menos do que pediu, um novo pedido será criado
                automaticamente
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd. Original</TableHead>
                  <TableHead className="text-center">Qtd. Recebida</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editPedido.produtos.map((produto, index) => {
                  const originalProduto = pedidos
                    ?.find((p) => p.id === editPedido.id)
                    ?.produtos.find((p) => p.produtoId === produto.produtoId);
                  const subtotal =
                    produto.quantidade *
                    produto.custo *
                    (produto.multiplicador ||
                      produto.produto?.multiplicador ||
                      1);
                  const isLessQuantity =
                    originalProduto &&
                    produto.quantidade < originalProduto.quantidade;

                  return (
                    <TableRow key={produto.produtoId}>
                      <TableCell>
                        <div className="font-medium">
                          {produto.produto?.nome}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          SKU: {produto.produto?.sku}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {originalProduto?.quantidade || produto.quantidade}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Input
                            type="number"
                            min="0"
                            value={produto.quantidade}
                            onChange={(e) =>
                              handleProdutoChange(
                                produto.produtoId,
                                "quantidade",
                                Number(e.target.value)
                              )
                            }
                            className={`w-20 text-center ${
                              isLessQuantity
                                ? "border-amber-500 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                                : ""
                            }`}
                            disabled={isSubmitting}
                          />
                        </div>
                        {isLessQuantity && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 text-center mt-1">
                            {originalProduto.quantidade - produto.quantidade}{" "}
                            unid. pendentes
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(produto.custo / 100).toFixed(2)}
                          onChange={(e) =>
                            handleProdutoChange(
                              produto.produtoId,
                              "custo",
                              Math.round(parseFloat(e.target.value) * 100)
                            )
                          }
                          className="w-24 text-right ml-auto"
                          disabled={isSubmitting}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBRL(subtotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-semibold">
                    Total:
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatBRL(calcularValorTotalPedido(editPedido))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setEditPedido(null)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting || !armazemId}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Confirmar Recebimento
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Total Geral: {formatBRL(calcularValorTotal())}
        </h3>
      </div>
    </div>
  );
};

export default PedidosPendentes;
