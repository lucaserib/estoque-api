"use client";

import { useState, useEffect } from "react";
import BarcodeReader from "./BarCodeReader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  QrCode,
  Package,
  Barcode,
  CheckCircle2,
  X,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Produto {
  id: string;
  nome: string;
  sku: string;
  codigosDeBarras?: {
    id: string;
    codigo: string;
    tipo: string;
  }[];
  ean?: string | number; // Campo legado para compatibilidade
  codigoEAN?: string; // Campo legado para compatibilidade
}

interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador?: number;
  produto?: Produto;
}

interface BarcodeScannerConferenciaProps {
  produtos: PedidoProduto[];
  onQuantidadeAtualizada: (produtoId: string, novaQuantidade: number) => void;
  onVoltarModoManual: () => void;
}

const BarcodeScannerConferencia = ({
  produtos,
  onQuantidadeAtualizada,
  onVoltarModoManual,
}: BarcodeScannerConferenciaProps) => {
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [historicoScans, setHistoricoScans] = useState<
    { codigoEAN: string; produtoId: string; nome: string; timestamp: Date }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [produtosMap, setProdutosMap] = useState<Map<string, PedidoProduto>>(
    new Map()
  );
  const [eanMap, setEanMap] = useState<Map<string, string>>(new Map()); // EAN -> produtoId
  const [produtosDesconhecidos, setProdutosDesconhecidos] = useState<
    { codigoEAN: string; timestamp: Date }[]
  >([]);
  const [inicializado, setInicializado] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [quantidadesOriginais, setQuantidadesOriginais] = useState<
    Map<string, number>
  >(new Map());

  // Adicionar função para mapear ean para codigoEAN (no início do componente)
  const getCodigoEAN = (produto: Produto): string | undefined => {
    if (!produto.codigosDeBarras || !Array.isArray(produto.codigosDeBarras)) {
      return undefined;
    }

    const codigoEAN = produto.codigosDeBarras.find(
      (codigo) => codigo.tipo === "EAN" || codigo.tipo === "GTIN"
    );

    return codigoEAN?.codigo;
  };

  // Modificar o useEffect para usar a função getCodigoEAN
  useEffect(() => {
    const prodMap = new Map<string, PedidoProduto>();
    const eanMapping = new Map<string, string>();
    const quantOriginais = new Map<string, number>();

    console.log("Iniciando mapeamento de produtos com códigos EAN:");
    produtos.forEach((produto) => {
      prodMap.set(produto.produtoId, produto);

      // Armazenar a quantidade original
      quantOriginais.set(produto.produtoId, produto.quantidade);

      // Log para verificar se codigoEAN existe e está sendo reconhecido
      console.log(
        `Produto: ${produto.produto?.nome} (ID: ${produto.produtoId})`
      );

      // Obter o código EAN usando a função utilitária
      const codigoEAN = produto.produto
        ? getCodigoEAN(produto.produto)
        : undefined;
      console.log(`  codigoEAN: ${codigoEAN || "Não definido"}`);
      console.log(`  ean original: ${produto.produto?.ean || "Não definido"}`);

      // Se o produto tiver código EAN, mapeamos para o ID do produto
      if (codigoEAN) {
        eanMapping.set(codigoEAN, produto.produtoId);
        console.log(`  Mapeando EAN ${codigoEAN} -> ID ${produto.produtoId}`);
      }
    });

    console.log("Mapa de EANs final:", Object.fromEntries(eanMapping));

    setProdutosMap(prodMap);
    setEanMap(eanMapping);
    setQuantidadesOriginais(quantOriginais);
  }, [produtos]);

  // Modificar o useEffect para zerar as quantidades apenas uma vez
  useEffect(() => {
    if (!inicializado) {
      // Zerar todas as quantidades quando entra no modo de conferência por código de barras
      produtos.forEach((produto) => {
        onQuantidadeAtualizada(produto.produtoId, 0);
      });

      // Limpar histórico e produtos desconhecidos
      setHistoricoScans([]);
      setProdutosDesconhecidos([]);

      console.log("Quantidades zeradas para conferência por código de barras");
      setInicializado(true);
    }
  }, [produtos, onQuantidadeAtualizada, inicializado]);

  // Função para lidar com um novo scan
  const handleScan = (codigoEAN: string) => {
    // Verificar se o código EAN corresponde a algum produto
    console.log(`Código EAN escaneado: ${codigoEAN}`);
    console.log(`Mapa de EANs atual:`, Object.fromEntries(eanMap));

    const produtoId = eanMap.get(codigoEAN);
    console.log(
      `Produto ID encontrado para o código: ${produtoId || "Nenhum"}`
    );

    if (!produtoId) {
      console.log(`EAN não encontrado no mapa!`);
      // Guardar o código desconhecido para referência
      setProdutosDesconhecidos((prev) => [
        {
          codigoEAN,
          timestamp: new Date(),
        },
        ...prev,
      ]);
      setError(`Produto com código ${codigoEAN} não encontrado neste pedido.`);
      return;
    }

    const produto = produtosMap.get(produtoId);
    if (!produto || !produto.produto) {
      setError(`Informações do produto não encontradas.`);
      return;
    }

    // Atualizar a quantidade
    const novaQuantidade = (produto.quantidade || 0) + 1;
    onQuantidadeAtualizada(produtoId, novaQuantidade);

    // Adicionar ao histórico
    setHistoricoScans((prev) => [
      {
        codigoEAN,
        produtoId,
        nome: produto.produto?.nome || "Produto desconhecido",
        timestamp: new Date(),
      },
      ...prev,
    ]);

    // Limpar qualquer erro anterior
    setError(null);
  };

  // Validação de código de barras
  const validarCodigoBarras = async (codigo: string): Promise<boolean> => {
    // Primeiro verificamos se é um EAN-13 válido (validação feita internamente pelo BarcodeReader)
    // Depois verificamos se o código existe no nosso mapeamento
    return eanMap.has(codigo);
  };

  // Limpar histórico
  const limparHistorico = () => {
    setHistoricoScans([]);
  };

  // Add a function to clear unknown products
  const limparProdutosDesconhecidos = () => {
    setProdutosDesconhecidos([]);
  };

  // Adicionar função para reiniciar a conferência
  const confirmarReiniciar = () => {
    setMostrarConfirmacao(true);
  };

  const cancelarReiniciar = () => {
    setMostrarConfirmacao(false);
  };

  const executarReiniciar = () => {
    // Zerar todas as quantidades
    produtos.forEach((produto) => {
      onQuantidadeAtualizada(produto.produtoId, 0);
    });

    // Limpar histórico e produtos desconhecidos
    setHistoricoScans([]);
    setProdutosDesconhecidos([]);

    console.log("Conferência reiniciada, quantidades zeradas");
    setMostrarConfirmacao(false);
  };

  // Função para calcular o total de itens contados
  const calcularTotalContado = (): number => {
    return produtos.reduce(
      (total, produto) => total + (produto.quantidade || 0),
      0
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 p-4 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-medium text-blue-800 dark:text-blue-300">
              Modo de Conferência por Código de Barras
            </h3>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 ml-2">
              {calcularTotalContado()} itens contados
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={confirmarReiniciar}
              className="flex items-center gap-1.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30"
              disabled={calcularTotalContado() === 0}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Zerar Contagem</span>
              {calcularTotalContado() > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-amber-100 dark:bg-amber-900/30 border-0 text-xs"
                >
                  {calcularTotalContado()}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onVoltarModoManual}
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Modo Manual
            </Button>
          </div>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
          Escaneie o código de barras dos produtos para conferir
          automaticamente. Os produtos serão incrementados a cada leitura.
        </p>
      </div>

      {mostrarConfirmacao && (
        <div className="absolute z-10 top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-red-200 dark:border-red-800 p-3 w-64">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            Tem certeza? Você perderá todos os {calcularTotalContado()} itens
            contados.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelarReiniciar}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={executarReiniciar}
              className="h-8 text-xs"
            >
              Sim, zerar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert
          variant="destructive"
          className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <BarcodeReader
        onScan={handleScan}
        placeholder="Escaneie ou digite o código EAN-13"
        scanButtonLabel="Iniciar Câmera"
        continuousMode={true}
        validateBarcode={validarCodigoBarras}
      />

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Barcode className="h-4 w-4 text-indigo-500" />
              Produtos do Pedido
            </h3>
            <Badge
              variant="outline"
              className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
            >
              <Package className="h-3 w-3 mr-1" />
              {produtos.length} itens
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Qtd.</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-32">Código EAN</TableHead>
                <TableHead className="text-right">Última Leitura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.map((produto) => {
                const ultimoScan = historicoScans.find(
                  (scan) => scan.produtoId === produto.produtoId
                );

                const temEAN = produto.produto
                  ? !!getCodigoEAN(produto.produto)
                  : false;

                return (
                  <TableRow
                    key={produto.produtoId}
                    className={
                      produto.quantidade !== 0 &&
                      quantidadesOriginais.get(produto.produtoId) !==
                        produto.quantidade
                        ? "bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                        : ""
                    }
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={produto.quantidade}
                          onChange={(e) =>
                            onQuantidadeAtualizada(
                              produto.produtoId,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className={`w-16 text-center ${
                            produto.quantidade !== 0 &&
                            quantidadesOriginais.get(produto.produtoId) !==
                              produto.quantidade
                              ? "border-yellow-300 dark:border-yellow-700"
                              : ""
                          }`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {produto.produto?.nome || "Produto não encontrado"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        SKU: {produto.produto?.sku || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {temEAN ? (
                        <div className="flex items-center gap-1">
                          <Barcode className="h-3 w-3 text-gray-500" />
                          <span className="font-mono text-xs">
                            {produto.produto
                              ? getCodigoEAN(produto.produto)
                              : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 italic">
                          Não cadastrado
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {ultimoScan ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {ultimoScan.timestamp.toLocaleTimeString()}
                          </span>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </div>
                      ) : temEAN ? (
                        <span className="text-xs text-gray-500 italic">
                          Não lido
                        </span>
                      ) : (
                        <X className="h-4 w-4 text-gray-400 ml-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {produtosDesconhecidos.length > 0 && (
        <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg overflow-hidden bg-yellow-50 dark:bg-yellow-900/20">
          <div className="bg-yellow-100 dark:bg-yellow-800/30 px-4 py-3 border-b border-yellow-200 dark:border-yellow-800 flex justify-between items-center">
            <h3 className="font-medium flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              Produtos Não Encontrados no Pedido
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={limparProdutosDesconhecidos}
              className="h-8 text-xs border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          </div>

          <div className="max-h-48 overflow-y-auto p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
              Estes códigos de barras foram escaneados, mas não correspondem a
              nenhum produto neste pedido.
            </p>
            <div className="space-y-2">
              {produtosDesconhecidos.map((item, index) => (
                <div
                  key={`${item.codigoEAN}-${index}`}
                  className="flex justify-between items-center py-2 px-3 bg-yellow-100/50 dark:bg-yellow-900/20 rounded text-sm border border-yellow-200 dark:border-yellow-800"
                >
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-mono">{item.codigoEAN}</span>
                  </div>
                  <span className="text-xs text-yellow-700 dark:text-yellow-300">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {historicoScans.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-500" />
              Histórico de Leituras
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={limparHistorico}
              className="h-8 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          </div>

          <div className="max-h-48 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoScans.map((scan, index) => (
                  <TableRow key={`${scan.codigoEAN}-${index}`}>
                    <TableCell className="text-xs">
                      {scan.timestamp.toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {scan.codigoEAN}
                    </TableCell>
                    <TableCell>{scan.nome}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerConferencia;
