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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
            className="bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800"
          >
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300">
              Erro
            </AlertTitle>
            <AlertDescription className="text-red-600 dark:text-red-400">
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
                <FormLabel className="flex items-center gap-2 text-base font-medium text-gray-700 dark:text-gray-300">
                  <Warehouse className="h-4 w-4 text-indigo-500" />
                  Armazém de Destino <span className="text-red-500">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="Selecione um armazém" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    {armazens.length > 0 ? (
                      armazens.map((armazem) => (
                        <SelectItem key={armazem.id} value={armazem.id}>
                          {armazem.nome}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-gray-500 dark:text-gray-400 text-center">
                        Nenhum armazém encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />

          {/* Comentários */}
          <FormField
            control={form.control}
            name="comentarios"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium text-gray-700 dark:text-gray-300">
                  Comentários (opcional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Adicione comentários sobre o recebimento do pedido"
                    {...field}
                    disabled={isSubmitting}
                    className="resize-none h-10 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                </FormControl>
                <FormMessage className="text-red-500" />
              </FormItem>
            )}
          />
        </div>

        {/* Informações do Pedido */}
        <Card className="border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-indigo-500" />
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                  Pedido #{pedido.id}
                </h3>
              </div>
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Confirmando Recebimento
              </Badge>
            </div>

            <div className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">Fornecedor:</span>{" "}
              {pedido.fornecedor.nome}
            </div>

            {hasMenorQuantidade() && (
              <Alert className="mt-2 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                  Se confirmar quantidades menores que as pedidas, um novo
                  pedido pendente será criado automaticamente com os itens
                  faltantes.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Tabela de produtos */}
        <Card className="border-gray-300 dark:border-gray-600 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-100 dark:bg-gray-800">
                  <TableRow>
                    <TableHead className="font-medium text-gray-700 dark:text-gray-300">
                      Produto
                    </TableHead>
                    <TableHead className="w-24 text-center font-medium text-gray-700 dark:text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        Qtd. Pedida
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-white dark:bg-gray-800 p-2 text-xs max-w-xs">
                              Quantidade original do pedido
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableHead>
                    <TableHead className="w-24 text-center font-medium text-gray-700 dark:text-gray-300">
                      <div className="flex items-center justify-center gap-1">
                        Qtd. Recebida
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3 w-3 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-white dark:bg-gray-800 p-2 text-xs max-w-xs">
                              Quantidade que você realmente recebeu. Se for
                              menor que a quantidade pedida, um novo pedido será
                              criado automaticamente para os itens faltantes.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableHead>
                    <TableHead className="w-32 text-right font-medium text-gray-700 dark:text-gray-300">
                      Custo Unitário
                    </TableHead>
                    <TableHead className="w-24 text-right font-medium text-gray-700 dark:text-gray-300">
                      Multiplicador
                    </TableHead>
                    <TableHead className="w-32 text-right font-medium text-gray-700 dark:text-gray-300">
                      Subtotal
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                      <TableRow
                        key={produto.produtoId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <TableCell>
                          <div className="font-medium text-gray-800 dark:text-gray-200">
                            {produto.produto?.nome || "Produto não encontrado"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            SKU: {produto.produto?.sku || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-gray-700 dark:text-gray-300">
                          {produto.quantidade}
                        </TableCell>
                        <TableCell className="text-center">
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
                            className={`w-20 text-center mx-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 ${
                              quantidade < produto.quantidade
                                ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                                : ""
                            }`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
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
                            className="w-24 text-right ml-auto bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                          />
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300">
                          {multiplicador}x
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-800 dark:text-gray-200">
                          {formatBRL(subtotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Linha do total */}
                  <TableRow className="border-t-2 bg-gray-50 dark:bg-gray-900/50">
                    <TableCell
                      colSpan={5}
                      className="text-right font-semibold text-gray-800 dark:text-gray-200"
                    >
                      Valor Total:
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-800 dark:text-gray-200">
                      {formatBRL(calcularValorTotal())}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
            className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !form.getValues("armazemId")}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
