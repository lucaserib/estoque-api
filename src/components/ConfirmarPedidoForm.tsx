"use client";

import React, { useState } from "react";
import { formatBRL } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertCircle,
  Check,
  Loader2,
  ShoppingBag,
  Warehouse,
  HelpCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Tipos
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

interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador?: number;
  produto?: Produto;
}

interface Pedido {
  id: number;
  fornecedor: Fornecedor;
  produtos: PedidoProduto[];
  comentarios: string;
  status: string;
  dataPrevista?: string;
  armazemId?: string;
  dataConclusao?: string;
}

// Definição do schema do formulário
const formSchema = z.object({
  armazemId: z.string({
    required_error: "Selecione um armazém para receber os produtos",
  }),
  comentarios: z.string().optional(),
  produtos: z.array(
    z.object({
      produtoId: z.string(),
      quantidade: z.number().min(0, "Quantidade não pode ser negativa"),
      custo: z.number().min(1, "Custo deve ser maior que zero"),
      multiplicador: z.number().optional(),
    })
  ),
});

type FormValues = z.infer<typeof formSchema>;

interface ConfirmarPedidoFormProps {
  pedido: Pedido;
  armazens: { id: string; nome: string }[];
  onSuccess: (pedidoId: number, novoPedidoId?: number) => void;
  onCancel: () => void;
}

const ConfirmarPedidoForm = ({
  pedido,
  armazens,
  onSuccess,
  onCancel,
}: ConfirmarPedidoFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preparar valores iniciais para o formulário
  const defaultValues: FormValues = {
    armazemId: "",
    comentarios: pedido.comentarios || "",
    produtos: pedido.produtos.map((produto) => ({
      produtoId: produto.produtoId,
      quantidade: produto.quantidade,
      custo: produto.custo,
      multiplicador:
        produto.multiplicador || produto.produto?.multiplicador || 1,
    })),
  };

  // Inicializar formulário com react-hook-form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Manipular envio do formulário
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/pedidos-compra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedido.id,
          armazemId: data.armazemId,
          produtosRecebidos: data.produtos,
          comentarios: data.comentarios,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Falha ao confirmar o pedido");
      }

      // Chamar callback de sucesso com ID do pedido e possivelmente do novo pedido para itens faltantes
      onSuccess(pedido.id, responseData.novoPedidoId);
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao confirmar o pedido"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Atualizar quantidade de um produto
  const handleQuantityChange = (index: number, value: number) => {
    const produtos = form.getValues("produtos");
    produtos[index].quantidade = value;
    form.setValue("produtos", produtos);
  };

  // Atualizar custo de um produto
  const handleCostChange = (index: number, value: number) => {
    const produtos = form.getValues("produtos");
    produtos[index].custo = value;
    form.setValue("produtos", produtos);
  };

  // Calcular valor total do pedido
  const calcularValorTotal = () => {
    const produtos = form.getValues("produtos");
    return produtos.reduce((total, produto) => {
      return (
        total +
        produto.quantidade * produto.custo * (produto.multiplicador || 1)
      );
    }, 0);
  };

  // Verificar se algum produto tem quantidade menor que a original
  const hasMenorQuantidade = () => {
    const produtos = form.getValues("produtos");
    return produtos.some(
      (produto, index) =>
        produto.quantidade < defaultValues.produtos[index].quantidade
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Mostrar erro se houver */}
        {error && (
          <Alert
            variant="destructive"
            className="bg-destructive/10 border-destructive/30"
          >
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">
              Erro
            </AlertTitle>
            <AlertDescription className="text-destructive">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Seleção de armazém */}
          <FormField
            control={form.control}
            name="armazemId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Warehouse className="h-4 w-4 text-primary" />
                  Armazém de Destino <span className="text-destructive">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 bg-card border-input">
                      <SelectValue placeholder="Selecione um armazém" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-input">
                    {armazens.length > 0 ? (
                      armazens.map((armazem) => (
                        <SelectItem key={armazem.id} value={armazem.id}>
                          {armazem.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-muted-foreground text-center">
                        Nenhum armazém encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage className="text-destructive" />
              </FormItem>
            )}
          />

          {/* Comentários */}
          <FormField
            control={form.control}
            name="comentarios"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium text-foreground">
                  Comentários (opcional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Adicione comentários sobre o recebimento do pedido"
                    {...field}
                    disabled={isSubmitting}
                    className="resize-none h-10 bg-card border-input"
                  />
                </FormControl>
                <FormMessage className="text-destructive" />
              </FormItem>
            )}
          />
        </div>

        {/* Informações do Pedido */}
        <Card className="border-input bg-background">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg text-foreground">
                  Pedido #{pedido.id}
                </h3>
              </div>
              <Badge className="bg-warning/10 text-warning">
                Confirmando Recebimento
              </Badge>
            </div>

            <div className="text-foreground">
              <span className="font-medium">Fornecedor:</span>{" "}
              {pedido.fornecedor.nome}
            </div>

            {hasMenorQuantidade() && (
              <Alert className="mt-2 bg-info/10 border-info/30">
                <HelpCircle className="h-4 w-4 text-info" />
                <AlertDescription className="text-info text-sm">
                  Se confirmar quantidades menores que as pedidas, um novo
                  pedido pendente será criado automaticamente com os itens
                  faltantes.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Tabela de produtos */}
        <Card className="border-input overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead className="pl-4">
                      Produto
                    </DataTableHead>
                    <DataTableHead className="w-24 text-center">
                      <div className="flex items-center justify-center gap-1">
                        Qtd. Pedida
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-card p-2 text-xs max-w-xs">
                              Quantidade original do pedido
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </DataTableHead>
                    <DataTableHead className="w-24 text-center">
                      <div className="flex items-center justify-center gap-1">
                        Qtd. Recebida
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-card p-2 text-xs max-w-xs">
                              Quantidade que você realmente recebeu. Se for
                              menor que a quantidade pedida, um novo pedido será
                              criado automaticamente para os itens faltantes.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </DataTableHead>
                    <DataTableHead className="w-32 text-right">
                      Custo Unitário
                    </DataTableHead>
                    <DataTableHead className="w-24 text-right">
                      Multiplicador
                    </DataTableHead>
                    <DataTableHead className="pr-4 w-32 text-right">
                      Subtotal
                    </DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {pedido.produtos.map((produto, index) => {
                    const multiplicador =
                      produto.multiplicador ||
                      produto.produto?.multiplicador ||
                      1;
                    const formProdutos = form.getValues("produtos");
                    const quantidade =
                      formProdutos[index]?.quantidade || produto.quantidade;
                    const custo = formProdutos[index]?.custo || produto.custo;
                    const subtotal = quantidade * custo * multiplicador;

                    return (
                      <DataTableRow key={produto.produtoId}>
                        <DataTableCell className="pl-4">
                          <div className="font-medium text-foreground">
                            {produto.produto?.nome || "Produto não encontrado"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            SKU: {produto.produto?.sku || "N/A"}
                          </div>
                        </DataTableCell>
                        <DataTableCell numeric className="text-center text-foreground">
                          {produto.quantidade}
                        </DataTableCell>
                        <DataTableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={quantidade}
                            onChange={(e) =>
                              handleQuantityChange(
                                index,
                                Number(e.target.value)
                              )
                            }
                            disabled={isSubmitting}
                            className={`w-20 text-center mx-auto bg-card border-input ${
                              quantidade < produto.quantidade
                                ? "border-warning bg-warning/10"
                                : ""
                            }`}
                          />
                        </DataTableCell>
                        <DataTableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={(custo / 100).toFixed(2)}
                            onChange={(e) =>
                              handleCostChange(
                                index,
                                Math.round(parseFloat(e.target.value) * 100)
                              )
                            }
                            disabled={isSubmitting}
                            className="w-24 text-right ml-auto bg-card border-input"
                          />
                        </DataTableCell>
                        <DataTableCell numeric className="text-foreground">
                          {multiplicador}x
                        </DataTableCell>
                        <DataTableCell numeric className="pr-4 font-medium text-foreground">
                          {formatBRL(subtotal)}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}

                  {/* Linha do total */}
                  <DataTableRow className="bg-muted font-medium hover:bg-muted">
                    <DataTableCell
                      colSpan={5}
                      className="pl-4 text-right font-semibold text-foreground"
                    >
                      Valor Total:
                    </DataTableCell>
                    <DataTableCell numeric className="pr-4 font-bold text-foreground">
                      {formatBRL(calcularValorTotal())}
                    </DataTableCell>
                  </DataTableRow>
                </DataTableBody>
              </DataTable>
            </div>
          </CardContent>
        </Card>

        {/* Botões */}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="border-input hover:bg-muted"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !form.getValues("armazemId")}
            className="gap-2 bg-success hover:bg-success/90 text-success-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirmar Recebimento
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ConfirmarPedidoForm;
