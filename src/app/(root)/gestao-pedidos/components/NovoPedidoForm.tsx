"use client";

import { useState, useEffect, useCallback } from "react";
import { brlToCents, centsToBRL, formatBRL } from "@/utils/currency";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// UI Components
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertCircle,
  CalendarIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Fornecedor {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  sku: string;
  multiplicador?: number;
}

interface ProdutoFornecedor {
  produtoId: string;
  fornecedorId: string;
  preco: number;
  multiplicador: number;
  codigoNF: string;
  produto: Produto;
}

interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador?: number;
  sku?: string;
  nome?: string;
}

const formSchema = z.object({
  fornecedorId: z.string({
    required_error: "Selecione um fornecedor",
  }),
  dataPrevista: z.date().optional(),
  comentarios: z.string().optional(),
  produtos: z
    .array(
      z.object({
        produtoId: z.string(),
        quantidade: z.number().min(1, "Quantidade deve ser maior que zero"),
        custo: z.number().min(1, "Custo deve ser maior que zero"),
        multiplicador: z.number().optional(),
        sku: z.string().optional(),
        nome: z.string().optional(),
      })
    )
    .min(1, "Adicione pelo menos um produto ao pedido"),
});

type FormValues = z.infer<typeof formSchema>;

interface NovoPedidoFormProps {
  onSuccess: () => void;
}

const NovoPedidoForm = ({ onSuccess }: NovoPedidoFormProps) => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtosFornecedor, setProdutosFornecedor] = useState<
    ProdutoFornecedor[]
  >([]);
  const [isLoadingFornecedores, setIsLoadingFornecedores] = useState(true);
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newProduct, setNewProduct] = useState<{
    produtoId: string;
    sku: string;
    nome: string;
    quantidade: number;
    custo: number;
    multiplicador: number;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fornecedorId: "",
      comentarios: "",
      produtos: [],
    },
  });

  useEffect(() => {
    const fetchFornecedores = async () => {
      setIsLoadingFornecedores(true);
      try {
        const response = await fetch("/api/fornecedores");
        if (!response.ok) throw new Error("Falha ao carregar fornecedores");

        const data = await response.json();
        setFornecedores(data);
      } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
        setError("Não foi possível carregar os fornecedores.");
      } finally {
        setIsLoadingFornecedores(false);
      }
    };

    fetchFornecedores();
  }, []);

  const loadProdutosFornecedor = useCallback(async (fornecedorId: string) => {
    if (!fornecedorId) return;

    setIsLoadingProdutos(true);
    setProdutosFornecedor([]);

    try {
      const response = await fetch(
        `/api/produto-fornecedor?fornecedorId=${fornecedorId}`
      );
      if (!response.ok)
        throw new Error("Falha ao carregar produtos do fornecedor");

      const data = await response.json();
      setProdutosFornecedor(data);
    } catch (error) {
      console.error("Erro ao buscar produtos do fornecedor:", error);
      setError("Não foi possível carregar os produtos do fornecedor.");
    } finally {
      setIsLoadingProdutos(false);
    }
  }, []);

  // Quando o fornecedor muda, carregar seus produtos
  useEffect(() => {
    const fornecedorId = form.watch("fornecedorId");

    // Função para carregar os produtos quando o fornecedor muda
    const carregarProdutos = () => {
      if (fornecedorId) {
        loadProdutosFornecedor(fornecedorId);
      }
    };

    carregarProdutos();

    // Registrar o watcher para monitorar mudanças no fornecedorId
    const subscription = form.watch((value, { name }) => {
      if (name === "fornecedorId") {
        carregarProdutos();
      }
    });

    // Cleanup: cancelar a subscrição ao desmontar o componente
    return () => subscription.unsubscribe();
  }, [form, loadProdutosFornecedor]);

  // Adicionar produto ao pedido
  const addProduct = (
    produtoFornecedor: ProdutoFornecedor,
    quantidade: number
  ) => {
    const produtos = form.getValues("produtos") || [];

    const existingIndex = produtos.findIndex(
      (p) => p.produtoId === produtoFornecedor.produtoId
    );

    if (existingIndex >= 0) {
      produtos[existingIndex].quantidade += quantidade;
    } else {
      produtos.push({
        produtoId: produtoFornecedor.produtoId,
        quantidade: quantidade,
        custo: produtoFornecedor.preco,
        multiplicador: produtoFornecedor.multiplicador,
        sku: produtoFornecedor.produto.sku,
        nome: produtoFornecedor.produto.nome,
      });
    }

    form.setValue("produtos", produtos);
    setNewProduct(null);
  };

  const removeProduct = (index: number) => {
    const produtos = form.getValues("produtos");
    produtos.splice(index, 1);
    form.setValue("produtos", produtos);
  };

  const updateQuantity = (index: number, quantidade: number) => {
    const produtos = form.getValues("produtos");
    produtos[index].quantidade = quantidade;
    form.setValue("produtos", produtos);
  };

  const calculateTotal = () => {
    const produtos = form.getValues("produtos") || [];
    return produtos.reduce((total, produto) => {
      return (
        total +
        produto.quantidade * produto.custo * (produto.multiplicador || 1)
      );
    }, 0);
  };

  const filteredProducts = produtosFornecedor.filter(
    (pf) =>
      pf.produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pf.produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fornecedorId: data.fornecedorId,
          produtos: data.produtos.map((p) => ({
            produtoId: p.produtoId,
            quantidade: p.quantidade,
            custo: p.custo,
            multiplicador: p.multiplicador,
          })),
          comentarios: data.comentarios,
          dataPrevista: data.dataPrevista
            ? data.dataPrevista.toISOString()
            : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao criar pedido");
      }

      onSuccess();
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao criar o pedido"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="fornecedorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fornecedor</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isSubmitting || isLoadingFornecedores}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingFornecedores ? (
                      <div className="flex justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : fornecedores.length > 0 ? (
                      fornecedores.map((fornecedor) => (
                        <SelectItem key={fornecedor.id} value={fornecedor.id}>
                          {fornecedor.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">
                        Nenhum fornecedor encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dataPrevista"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data Prevista (opcional)</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal ${
                          !field.value && "text-muted-foreground"
                        }`}
                        disabled={isSubmitting}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value
                          ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                          : "Selecione uma data"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                      disabled={(date) => date < new Date()}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="comentarios"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comentários (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Adicione observações ou instruções para este pedido"
                  {...field}
                  disabled={isSubmitting}
                  className="resize-none"
                  rows={2}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border rounded-md p-4 bg-muted/30">
          <h3 className="text-lg font-semibold mb-4">Adicionar Produtos</h3>

          {!form.getValues("fornecedorId") ? (
            <div className="text-center p-4 text-muted-foreground">
              Selecione um fornecedor para adicionar produtos
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome ou SKU"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    disabled={isSubmitting || isLoadingProdutos}
                  />
                </div>
              </div>

              {isLoadingProdutos ? (
                <div className="flex items-center justify-center p-6 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin text-primary " />
                  <span className="ml-2 text-muted-foreground">
                    Carregando produtos...
                  </span>
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="border rounded-md overflow-hidden mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-24 text-right">Preço</TableHead>
                        <TableHead className="w-32">Quantidade</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.slice(0, 5).map((pf) => (
                        <TableRow key={pf.produtoId}>
                          <TableCell>
                            <div className="font-medium">{pf.produto.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              SKU: {pf.produto.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBRL(pf.preco)}
                            {pf.multiplicador > 1 && (
                              <span className="text-xs text-muted-foreground block">
                                Mult: {pf.multiplicador}x
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Qtd"
                              value={
                                newProduct?.produtoId === pf.produtoId
                                  ? newProduct.quantidade
                                  : ""
                              }
                              onChange={(e) =>
                                setNewProduct({
                                  produtoId: pf.produtoId,
                                  sku: pf.produto.sku,
                                  nome: pf.produto.nome,
                                  quantidade: Number(e.target.value),
                                  custo: pf.preco,
                                  multiplicador: pf.multiplicador,
                                })
                              }
                              className="w-20"
                              disabled={isSubmitting}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (
                                  newProduct?.produtoId === pf.produtoId &&
                                  newProduct.quantidade > 0
                                ) {
                                  addProduct(pf, newProduct.quantidade);
                                } else {
                                  addProduct(pf, 1);
                                }
                              }}
                              disabled={isSubmitting}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center p-4 text-muted-foreground border rounded-md">
                  {searchTerm
                    ? "Nenhum produto encontrado para este termo de busca"
                    : "Nenhum produto disponível para este fornecedor"}
                </div>
              )}
            </>
          )}

          <FormField
            control={form.control}
            name="produtos"
            render={() => (
              <FormItem>
                <FormLabel className="text-base">Produtos no Pedido</FormLabel>
                <div className="mt-2">
                  {form.getValues("produtos")?.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="w-24 text-right">
                              Quantidade
                            </TableHead>
                            <TableHead className="w-28 text-right">
                              Preço Unit.
                            </TableHead>
                            <TableHead className="w-28 text-right">
                              Subtotal
                            </TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.getValues("produtos").map((produto, index) => {
                            const subtotal =
                              produto.quantidade *
                              produto.custo *
                              (produto.multiplicador || 1);

                            return (
                              <TableRow key={index}>
                                <TableCell>
                                  <div className="font-medium">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    SKU: {produto.sku}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={produto.quantidade}
                                    onChange={(e) =>
                                      updateQuantity(
                                        index,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-16 text-right ml-auto"
                                    disabled={isSubmitting}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  {centsToBRL(produto.custo)}
                                  {produto.multiplicador &&
                                    produto.multiplicador > 1 && (
                                      <span className="text-xs text-muted-foreground block">
                                        Mult: {produto.multiplicador}x
                                      </span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatBRL(subtotal)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeProduct(index)}
                                    disabled={isSubmitting}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}

                          <TableRow className="border-t-2">
                            <TableCell
                              colSpan={3}
                              className="text-right font-semibold"
                            >
                              Valor Total:
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatBRL(calculateTotal())}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center p-6 border rounded-md text-muted-foreground bg-muted">
                      Nenhum produto adicionado ao pedido
                    </div>
                  )}
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="submit" className="gap-2" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Criar Pedido"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default NovoPedidoForm;
