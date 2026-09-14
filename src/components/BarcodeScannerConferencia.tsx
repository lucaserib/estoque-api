"use client";

import { useState, useEffect } from "react";
import BarcodeReader from "./BarCodeReader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
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
      <div className="bg-primary/10 rounded-lg border border-primary/30 p-4 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="font-medium text-primary">
              Modo de Conferência por Código de Barras
            </h3>
            <Badge className="bg-success/10 text-success ml-2">
              {calcularTotalContado()} itens contados
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={confirmarReiniciar}
              className="flex items-center gap-1.5 border-warning/40 text-warning hover:bg-warning/10"
              disabled={calcularTotalContado() === 0}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Zerar Contagem</span>
              {calcularTotalContado() > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-warning/10 border-0 text-xs"
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
        <p className="text-sm text-primary mt-2">
          Escaneie o código de barras dos produtos para conferir
          automaticamente. Os produtos serão incrementados a cada leitura.
        </p>
      </div>

      {mostrarConfirmacao && (
        <div className="absolute z-10 top-full mt-2 right-0 bg-card rounded-lg shadow-lg border border-destructive/30 p-3 w-64">
          <p className="text-sm text-destructive mb-2">
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
          className="bg-destructive/10 border-destructive/30"
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

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-background px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Barcode className="h-4 w-4 text-primary" />
              Produtos do Pedido
            </h3>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/30"
            >
              <Package className="h-3 w-3 mr-1" />
              {produtos.length} itens
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead className="w-14">Qtd.</DataTableHead>
                <DataTableHead>Produto</DataTableHead>
                <DataTableHead className="w-32">Código EAN</DataTableHead>
                <DataTableHead className="text-right">Última Leitura</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {produtos.map((produto) => {
                const ultimoScan = historicoScans.find(
                  (scan) => scan.produtoId === produto.produtoId
                );

                const temEAN = produto.produto
                  ? !!getCodigoEAN(produto.produto)
                  : false;

                return (
                  <DataTableRow
                    key={produto.produtoId}
                    className={
                      produto.quantidade !== 0 &&
                      quantidadesOriginais.get(produto.produtoId) !==
                        produto.quantidade
                        ? "bg-warning/10 hover:bg-warning/20"
                        : ""
                    }
                  >
                    <DataTableCell className="font-medium">
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
                              ? "border-warning"
                              : ""
                          }`}
                        />
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="font-medium text-foreground">
                        {produto.produto?.nome || "Produto não encontrado"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        SKU: {produto.produto?.sku || "N/A"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      {temEAN ? (
                        <div className="flex items-center gap-1">
                          <Barcode className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-xs">
                            {produto.produto
                              ? getCodigoEAN(produto.produto)
                              : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Não cadastrado
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      {ultimoScan ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {ultimoScan.timestamp.toLocaleTimeString()}
                          </span>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </div>
                      ) : temEAN ? (
                        <span className="text-xs text-muted-foreground italic">
                          Não lido
                        </span>
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground ml-auto" />
                      )}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </div>
      </div>

      {produtosDesconhecidos.length > 0 && (
        <div className="border border-warning/30 rounded-lg overflow-hidden bg-warning/10">
          <div className="bg-warning/20 px-4 py-3 border-b border-warning/30 flex justify-between items-center">
            <h3 className="font-medium flex items-center gap-2 text-warning">
              <AlertCircle className="h-4 w-4 text-warning" />
              Produtos Não Encontrados no Pedido
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={limparProdutosDesconhecidos}
              className="h-8 text-xs border-warning/40 text-warning"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          </div>

          <div className="max-h-48 overflow-y-auto p-4">
            <p className="text-sm text-warning mb-2">
              Estes códigos de barras foram escaneados, mas não correspondem a
              nenhum produto neste pedido.
            </p>
            <div className="space-y-2">
              {produtosDesconhecidos.map((item, index) => (
                <div
                  key={`${item.codigoEAN}-${index}`}
                  className="flex justify-between items-center py-2 px-3 bg-warning/10 rounded text-sm border border-warning/30"
                >
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-warning" />
                    <span className="font-mono">{item.codigoEAN}</span>
                  </div>
                  <span className="text-xs text-warning">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {historicoScans.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-background px-4 py-3 border-b border-border flex justify-between items-center">
            <h3 className="font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
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
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Hora</DataTableHead>
                  <DataTableHead>Código</DataTableHead>
                  <DataTableHead>Produto</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {historicoScans.map((scan, index) => (
                  <DataTableRow key={`${scan.codigoEAN}-${index}`}>
                    <DataTableCell className="text-xs">
                      {scan.timestamp.toLocaleTimeString()}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs">
                      {scan.codigoEAN}
                    </DataTableCell>
                    <DataTableCell>{scan.nome}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScannerConferencia;
