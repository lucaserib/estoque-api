"use client";

import { useState, useEffect } from "react";
import BarcodeReader from "@/components/BarCodeReader";
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
  Warehouse,
  CheckCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Saida, Produto as ProdutoBase } from "../types";

// Interface estendida para incluir a propriedade ean
interface ProdutoComEAN extends ProdutoBase {
  codigoEAN?: string;
  ean?: string | number;
}

interface SaidaDetalhe {
  id: number;
  produto: ProdutoComEAN;
  quantidade: number;
  quantidadeConferida?: number;
  isKit: boolean;
}

interface BarcodeScannerSaidasConferenciaProps {
  saida: Saida;
  onQuantidadeAtualizada: (detalheId: number, novaQuantidade: number) => void;
  onConferenciaCompleta: (conferido: boolean) => void;
  onVoltarModoManual: () => void;
}

const BarcodeScannerSaidasConferencia = ({
  saida,
  onQuantidadeAtualizada,
  onConferenciaCompleta,
  onVoltarModoManual,
}: BarcodeScannerSaidasConferenciaProps) => {
  const [historicoScans, setHistoricoScans] = useState<
    { codigoEAN: string; detalheId: number; nome: string; timestamp: Date }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [detalhesMap, setDetalhesMap] = useState<Map<number, SaidaDetalhe>>(
    new Map()
  );
  const [eanMap, setEanMap] = useState<Map<string, number>>(new Map()); // EAN -> detalheId
  const [produtosDesconhecidos, setProdutosDesconhecidos] = useState<
    { codigoEAN: string; timestamp: Date }[]
  >([]);
  const [inicializado, setInicializado] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [quantidadesOriginais, setQuantidadesOriginais] = useState<
    Map<number, number>
  >(new Map());
  const [conferido, setConferido] = useState(false);

  // Função para extrair o código EAN de um produto
  const getCodigoEAN = (produto: ProdutoComEAN): string | undefined => {
    if (produto?.codigoEAN) {
      return produto.codigoEAN;
    }

    if (produto?.ean) {
      return produto.ean.toString();
    }

    return undefined;
  };

  // Mapeamento de detalhes da saída e códigos EAN
  useEffect(() => {
    const detMap = new Map<number, SaidaDetalhe>();
    const eanMapping = new Map<string, number>();
    const quantOriginais = new Map<number, number>();

    console.log("Iniciando mapeamento de produtos da saída com códigos EAN:");

    saida.detalhes.forEach((detalhe) => {
      // Tratar o produto como ProdutoComEAN
      const detalheComConferencia: SaidaDetalhe = {
        ...detalhe,
        quantidadeConferida: 0, // Inicializar a quantidade conferida como 0
        produto: detalhe.produto as ProdutoComEAN,
      };

      detMap.set(detalhe.id, detalheComConferencia);

      // Armazenar a quantidade original
      quantOriginais.set(detalhe.id, detalhe.quantidade);

      // Log para verificar se codigoEAN existe
      console.log(`Produto: ${detalhe.produto.nome} (ID: ${detalhe.id})`);

      // Obter o código EAN usando a função utilitária
      const codigoEAN = getCodigoEAN(detalhe.produto as ProdutoComEAN);
      console.log(`  codigoEAN: ${codigoEAN || "Não definido"}`);
      console.log(
        `  ean original: ${(detalhe.produto as any).ean || "Não definido"}`
      );

      // Se o produto tiver código EAN, mapeamos para o ID do detalhe
      if (codigoEAN) {
        eanMapping.set(codigoEAN, detalhe.id);
        console.log(`  Mapeando EAN ${codigoEAN} -> ID ${detalhe.id}`);
      }
    });

    console.log("Mapa de EANs final:", Object.fromEntries(eanMapping));

    setDetalhesMap(detMap);
    setEanMap(eanMapping);
    setQuantidadesOriginais(quantOriginais);
  }, [saida]);

  // Inicialização das quantidades conferidas
  useEffect(() => {
    if (!inicializado) {
      // Zerar todas as quantidades quando entra no modo de conferência por código de barras
      saida.detalhes.forEach((detalhe) => {
        onQuantidadeAtualizada(detalhe.id, 0);
      });

      // Limpar histórico e produtos desconhecidos
      setHistoricoScans([]);
      setProdutosDesconhecidos([]);

      console.log(
        "Quantidades zeradas para conferência de saída por código de barras"
      );
      setInicializado(true);
    }
  }, [saida, onQuantidadeAtualizada, inicializado]);

  // Verificar se a conferência está completa (todas as quantidades conferidas batem com as originais)
  useEffect(() => {
    if (saida.detalhes.length === 0) return;

    let todas_conferidas = true;
    let alguma_conferida = false;

    saida.detalhes.forEach((detalhe) => {
      const detalheMapeado = detalhesMap.get(detalhe.id);
      if (!detalheMapeado) return;

      // Se alguma quantidade foi conferida, mas não corresponde à quantidade original
      if (detalheMapeado.quantidadeConferida !== detalhe.quantidade) {
        todas_conferidas = false;
      }

      // Se alguma quantidade foi conferida
      if (
        detalheMapeado.quantidadeConferida &&
        detalheMapeado.quantidadeConferida > 0
      ) {
        alguma_conferida = true;
      }
    });

    // Só é considerado completamente conferido se todas as quantidades baterem
    const novoStatus = todas_conferidas && alguma_conferida;
    if (novoStatus !== conferido) {
      setConferido(novoStatus);
      onConferenciaCompleta(novoStatus);
    }
  }, [saida.detalhes, detalhesMap, conferido, onConferenciaCompleta]);

  // Função para lidar com um novo scan
  const handleScan = (codigoEAN: string) => {
    // Verificar se o código EAN corresponde a algum produto
    console.log(`Código EAN escaneado: ${codigoEAN}`);
    console.log(`Mapa de EANs atual:`, Object.fromEntries(eanMap));

    const detalheId = eanMap.get(codigoEAN);
    console.log(
      `Detalhe ID encontrado para o código: ${detalheId || "Nenhum"}`
    );

    if (!detalheId) {
      console.log(`EAN não encontrado no mapa!`);
      // Guardar o código desconhecido
      setProdutosDesconhecidos((prev) => [
        {
          codigoEAN,
          timestamp: new Date(),
        },
        ...prev,
      ]);
      setError(`Produto com código ${codigoEAN} não encontrado nesta saída.`);
      return;
    }

    const detalhe = detalhesMap.get(detalheId);
    if (!detalhe) {
      setError(`Informações do detalhe da saída não encontradas.`);
      return;
    }

    // Atualizar a quantidade conferida
    const novaQuantidade = (detalhe.quantidadeConferida || 0) + 1;
    onQuantidadeAtualizada(detalheId, novaQuantidade);

    // Atualizar o detalhesMap
    detalhesMap.set(detalheId, {
      ...detalhe,
      quantidadeConferida: novaQuantidade,
    });
    setDetalhesMap(new Map(detalhesMap));

    // Adicionar ao histórico
    setHistoricoScans((prev) => [
      {
        codigoEAN,
        detalheId,
        nome: detalhe.produto.nome || "Produto desconhecido",
        timestamp: new Date(),
      },
      ...prev,
    ]);

    // Limpar qualquer erro anterior
    setError(null);
  };

  // Validação de código de barras
  const validarCodigoBarras = async (codigo: string): Promise<boolean> => {
    return eanMap.has(codigo);
  };

  // Limpar histórico
  const limparHistorico = () => {
    setHistoricoScans([]);
  };

  // Limpar produtos desconhecidos
  const limparProdutosDesconhecidos = () => {
    setProdutosDesconhecidos([]);
  };

  // Reiniciar conferência
  const confirmarReiniciar = () => {
    setMostrarConfirmacao(true);
  };

  const cancelarReiniciar = () => {
    setMostrarConfirmacao(false);
  };

  const executarReiniciar = () => {
    // Zerar todas as quantidades
    saida.detalhes.forEach((detalhe) => {
      onQuantidadeAtualizada(detalhe.id, 0);

      // Atualizar o detalhesMap
      const detalheAtual = detalhesMap.get(detalhe.id);
      if (detalheAtual) {
        detalhesMap.set(detalhe.id, {
          ...detalheAtual,
          quantidadeConferida: 0,
        });
      }
    });

    setDetalhesMap(new Map(detalhesMap));

    // Limpar histórico e produtos desconhecidos
    setHistoricoScans([]);
    setProdutosDesconhecidos([]);

    console.log("Conferência de saída reiniciada, quantidades zeradas");
    setMostrarConfirmacao(false);
  };

  // Função para calcular o total de itens contados
  const calcularTotalContado = (): number => {
    let total = 0;
    detalhesMap.forEach((detalhe) => {
      total += detalhe.quantidadeConferida || 0;
    });
    return total;
  };

  // Função para calcular o total de itens esperados
  const calcularTotalEsperado = (): number => {
    return saida.detalhes.reduce(
      (total, detalhe) => total + detalhe.quantidade,
      0
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 p-4 relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-medium text-indigo-800 dark:text-indigo-300">
              Conferência de Saída por Código de Barras
            </h3>
            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 ml-2">
              {calcularTotalContado()} de {calcularTotalEsperado()} itens
            </Badge>
            {conferido && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Conferido
              </Badge>
            )}
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
        <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
          Escaneie o código de barras dos produtos para conferir a saída. Os
          produtos serão incrementados a cada leitura.
        </p>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white/50 dark:bg-gray-800/30 p-3 rounded-md">
          <div className="flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Armazém: <strong>{saida.armazem.nome}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Data: <strong>{new Date(saida.data).toLocaleDateString()}</strong>
            </span>
          </div>
        </div>
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
              Produtos da Saída
            </h3>
            <Badge
              variant="outline"
              className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
            >
              <Package className="h-3 w-3 mr-1" />
              {saida.detalhes.length} itens
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Conf.</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-20 text-center">Esperado</TableHead>
                <TableHead className="w-32">Código EAN</TableHead>
                <TableHead className="text-right">Última Leitura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saida.detalhes.map((detalhe) => {
                const detalheInfo = detalhesMap.get(detalhe.id);
                const quantidadeConferida =
                  detalheInfo?.quantidadeConferida || 0;
                const ultimoScan = historicoScans.find(
                  (scan) => scan.detalheId === detalhe.id
                );

                const temEAN = !!getCodigoEAN(detalhe.produto as ProdutoComEAN);
                const diferente = quantidadeConferida !== detalhe.quantidade;
                const classeStatus =
                  quantidadeConferida === 0
                    ? ""
                    : diferente
                    ? quantidadeConferida < detalhe.quantidade
                      ? "bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                      : "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
                    : "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30";

                return (
                  <TableRow key={detalhe.id} className={classeStatus}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={quantidadeConferida}
                          onChange={(e) =>
                            onQuantidadeAtualizada(
                              detalhe.id,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className={`w-16 text-center ${
                            quantidadeConferida !== 0 && diferente
                              ? quantidadeConferida < detalhe.quantidade
                                ? "border-yellow-300 dark:border-yellow-700"
                                : "border-red-300 dark:border-red-700"
                              : quantidadeConferida > 0
                              ? "border-green-300 dark:border-green-700"
                              : ""
                          }`}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-800 dark:text-gray-200">
                        {detalhe.produto.nome || "Produto não encontrado"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        SKU: {detalhe.produto.sku || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`
                          ${
                            quantidadeConferida === 0
                              ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                              : diferente
                              ? quantidadeConferida < detalhe.quantidade
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          }
                        `}
                      >
                        {detalhe.quantidade} un.
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {temEAN ? (
                        <div className="flex items-center gap-1">
                          <Barcode className="h-3 w-3 text-gray-500" />
                          <span className="font-mono text-xs">
                            {getCodigoEAN(detalhe.produto as ProdutoComEAN)}
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
              Produtos Não Encontrados na Saída
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
              nenhum produto nesta saída.
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

export default BarcodeScannerSaidasConferencia;
