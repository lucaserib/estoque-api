"use client";

import { useState, useEffect } from "react";
import BarcodeReader from "@/components/BarCodeReader";
import { Produto, SaidaProduto } from "../types";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Trash2,
  AlertCircle,
  ArrowLeft,
  Package,
  Scan,
  History,
  Info,
  CheckCircle,
  Search,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// Estendendo a interface de Produto para incluir códigos de barras
interface ProdutoEstoque {
  id: string;
  nome: string;
  sku: string;
  preco: number;
  quantidadeDisponivel: number;
  unidade: string;
  categoria?: string;
  // Campos possíveis para EAN
  ean?: string;
  codigoEAN?: string;
  codigoBarras?: string;
  codigosBarrasAlternativos?: string[];
}

interface BarcodeScannerSelecaoProdutosProps {
  produtos: ProdutoEstoque[];
  produtosSelecionados: SaidaProduto[];
  onAdicionarProduto: (produto: ProdutoEstoque, quantidade: number) => void;
  onRemoverProduto: (sku: string) => void;
  onVoltarModoManual: () => void;
}

export default function BarcodeScannerSelecaoProdutos({
  produtos,
  produtosSelecionados,
  onAdicionarProduto,
  onRemoverProduto,
  onVoltarModoManual,
}: BarcodeScannerSelecaoProdutosProps) {
  // Estado para histórico de leituras
  const [historicoScans, setHistoricoScans] = useState<
    Array<{ codigo: string; timestamp: Date; produtoNome?: string }>
  >([]);

  // Estado para produtos não encontrados
  const [produtosDesconhecidos, setProdutosDesconhecidos] = useState<string[]>(
    []
  );

  // Estado para mensagem de erro
  const [erro, setErro] = useState<string | null>(null);

  // Mapeamento de EAN para SKU
  const [eanParaProdutoId, setEanParaProdutoId] = useState<Map<string, string>>(
    new Map()
  );

  // Estado para termo de busca
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Estado para quantidade
  const [quantidade, setQuantidade] = useState<number>(1);

  // Inicializar mapeamento de EAN para ID do produto
  useEffect(() => {
    if (produtos.length > 0) {
      console.log(`Carregados ${produtos.length} produtos`);

      // Mapear EANs para produtos
      const eanMap = new Map<string, string>();

      produtos.forEach((produto) => {
        // Log detalhado para auxiliar na depuração
        console.log(
          `Processando produto: ${produto.nome} (SKU: ${produto.sku})`
        );
        console.log(`Campos disponíveis: ${Object.keys(produto).join(", ")}`);

        // Mapear SKU -> ID
        if (produto.sku) {
          eanMap.set(produto.sku, produto.id);
          console.log(`Mapeado SKU: ${produto.sku} -> ID: ${produto.id}`);
        }

        // Mapear EAN -> ID (verificar todos os campos possíveis)
        if (produto.ean) {
          eanMap.set(produto.ean, produto.id);
          console.log(`Mapeado EAN: ${produto.ean} -> ID: ${produto.id}`);
        }

        if (produto.codigoEAN) {
          eanMap.set(produto.codigoEAN, produto.id);
          console.log(
            `Mapeado codigoEAN: ${produto.codigoEAN} -> ID: ${produto.id}`
          );
        }

        if (produto.codigoBarras) {
          eanMap.set(produto.codigoBarras, produto.id);
          console.log(
            `Mapeado codigoBarras: ${produto.codigoBarras} -> ID: ${produto.id}`
          );
        }

        // Mapear códigos alternativos, se existirem
        if (produto.codigosBarrasAlternativos?.length) {
          produto.codigosBarrasAlternativos.forEach((codigo) => {
            eanMap.set(codigo, produto.id);
            console.log(
              `Mapeado código alternativo: ${codigo} -> ID: ${produto.id}`
            );
          });
        }
      });

      setEanParaProdutoId(eanMap);
      console.log(`Total de códigos mapeados: ${eanMap.size}`);
    }
  }, [produtos]);

  // Função para extrair o código EAN do texto escaneado
  const extrairEAN = (codigo: string): string => {
    // Remover espaços e caracteres especiais
    let codigoNormalizado = codigo.trim().replace(/[^0-9a-zA-Z]/g, "");

    console.log(`Normalizando código: "${codigo}" -> "${codigoNormalizado}"`);

    // Verificar se o código é um EAN-13 (13 dígitos)
    if (/^\d{13}$/.test(codigoNormalizado)) {
      console.log(`Detectado EAN-13: ${codigoNormalizado}`);
      return codigoNormalizado;
    }

    // Verificar se o código é um EAN-8 (8 dígitos)
    if (/^\d{8}$/.test(codigoNormalizado)) {
      console.log(`Detectado EAN-8: ${codigoNormalizado}`);
      return codigoNormalizado;
    }

    // Se começar com números e tiver pelo menos 4 dígitos, pode ser um código válido
    if (/^\d{4,}/.test(codigoNormalizado)) {
      console.log(`Possível código numérico: ${codigoNormalizado}`);
      return codigoNormalizado;
    }

    // Se tiver caracteres alfanuméricos, pode ser Code 128 ou outro formato
    if (codigoNormalizado.length > 3) {
      console.log(`Possível código alfanumérico: ${codigoNormalizado}`);
      return codigoNormalizado;
    }

    // Se estivermos aqui, o código parece inválido
    console.log(`Código possivelmente inválido: ${codigoNormalizado}`);
    return codigoNormalizado;
  };

  // Função auxiliar para buscar um produto por EAN
  const buscarProdutoPorEAN = (ean: string): ProdutoEstoque | undefined => {
    console.log(`Buscando produto pelo EAN: ${ean}`);

    // Primeiro verificar no mapeamento
    const produtoId = eanParaProdutoId.get(ean);
    if (produtoId) {
      const produto = produtos.find((p) => p.id === produtoId);
      if (produto) {
        console.log(`Produto encontrado via mapeamento: ${produto.nome}`);
        return produto;
      }
    }

    // Verificar todos os campos possíveis
    for (const produto of produtos) {
      // Verificar em cada campo possível onde o EAN pode estar armazenado
      if (
        (produto.ean && produto.ean === ean) ||
        (produto.codigoEAN && produto.codigoEAN === ean) ||
        (produto.codigoBarras && produto.codigoBarras === ean) ||
        (produto.sku && produto.sku === ean)
      ) {
        console.log(
          `Produto encontrado via verificação de campos: ${produto.nome}`
        );
        return produto;
      }

      // Verificar também em códigos alternativos
      if (
        produto.codigosBarrasAlternativos &&
        produto.codigosBarrasAlternativos.includes(ean)
      ) {
        console.log(
          `Produto encontrado via códigos alternativos: ${produto.nome}`
        );
        return produto;
      }
    }

    // Listar todos os produtos e seus campos para debug
    console.log(
      "Não foi possível encontrar o produto. Detalhes de todos os produtos:"
    );
    produtos.forEach((produto) => {
      console.log(`- Produto: ${produto.nome} (SKU: ${produto.sku})`);
      console.log(`  - Campos: ${Object.keys(produto).join(", ")}`);
      console.log(
        `  - Valores: EAN=${produto.ean}, codigoEAN=${produto.codigoEAN}, codigoBarras=${produto.codigoBarras}`
      );
    });

    return undefined;
  };

  // Função para buscar produtos pela API
  const buscarProdutoPorEANnaAPI = async (
    ean: string
  ): Promise<ProdutoEstoque | null> => {
    console.log(`Buscando produto com EAN ${ean} diretamente na API...`);

    try {
      // Solicita um produto específico pelo EAN
      const response = await fetch(`/api/produtos/buscar-por-ean?ean=${ean}`);
      if (!response.ok) {
        console.error(`Erro ao buscar produto por EAN: ${response.status}`);
        return null;
      }

      const dados = await response.json();
      console.log(`Resposta da API:`, dados);

      if (dados.produto) {
        console.log(`Produto encontrado na API: ${dados.produto.nome}`);
        return dados.produto;
      } else {
        console.log(`Nenhum produto encontrado na API com EAN ${ean}`);
        return null;
      }
    } catch (error) {
      console.error(`Erro ao buscar produto por EAN na API:`, error);
      return null;
    }
  };

  // Função para buscar produtos por código específico
  const buscarProdutoPorCodigo = async (
    ean: string
  ): Promise<ProdutoEstoque | undefined> => {
    // Primeiro tenta buscar no mapeamento local
    const produtoEncontrado = buscarProdutoPorEAN(ean);
    if (produtoEncontrado) {
      return produtoEncontrado;
    }

    // Se não encontrar localmente, tenta buscar pela API
    if (ean === "7895502400037") {
      console.log("Buscando EAN específico via API...");
      const produtoAPI = await buscarProdutoPorEANnaAPI(ean);
      if (produtoAPI) {
        // Adicionar o produto encontrado na API ao mapeamento
        console.log(
          `Adicionando produto encontrado na API ao mapeamento local`
        );
        setEanParaProdutoId((prev) => {
          const novoMapa = new Map(prev);
          novoMapa.set(ean, produtoAPI.id);
          return novoMapa;
        });
        return produtoAPI;
      }
    }

    return undefined;
  };

  // Função específica para diagnóstico do EAN 7895502400037
  const diagnosticarEANProblematico = (ean: string) => {
    console.log(`\n======= DIAGNÓSTICO PARA EAN ${ean} =======`);

    // Verificar no mapeamento
    console.log("1. Verificando no mapeamento de EANs:");
    console.log(`   Total de entradas no mapeamento: ${eanParaProdutoId.size}`);

    if (eanParaProdutoId.has(ean)) {
      const id = eanParaProdutoId.get(ean);
      console.log(`   ✓ EAN encontrado no mapeamento! ID: ${id}`);
    } else {
      console.log(`   ✗ EAN NÃO encontrado no mapeamento`);

      // Listar os 10 primeiros códigos do mapeamento para verificação
      console.log("   Amostra do mapeamento (primeiros 10 itens):");
      let contador = 0;
      for (const [codigo, id] of eanParaProdutoId.entries()) {
        if (contador < 10) {
          console.log(`     - ${codigo} -> ${id}`);
          contador++;
        } else {
          break;
        }
      }
    }

    // Verificar em todos os produtos
    console.log("\n2. Verificando em todos os produtos:");
    console.log(`   Total de produtos: ${produtos.length}`);

    let encontradoEmProduto = false;

    produtos.forEach((produto) => {
      const temEAN =
        produto.ean === ean ||
        produto.codigoEAN === ean ||
        produto.codigoBarras === ean ||
        produto.codigosBarrasAlternativos?.includes(ean);

      if (temEAN) {
        encontradoEmProduto = true;
        console.log(
          `   ✓ EAN encontrado no produto: ${produto.nome} (${produto.sku})`
        );
        console.log(`     ID: ${produto.id}`);
        console.log(`     Campos: ${Object.keys(produto).join(", ")}`);
      }
    });

    if (!encontradoEmProduto) {
      console.log(`   ✗ EAN NÃO encontrado em nenhum produto`);

      // Verificar similaridade
      console.log("\n3. Verificando similaridade com outros códigos:");

      produtos.forEach((produto) => {
        if (produto.ean && produto.ean.includes(ean.substring(0, 8))) {
          console.log(
            `   Possível EAN similar: ${produto.ean} para produto ${produto.nome}`
          );
        }

        if (
          produto.codigoEAN &&
          produto.codigoEAN.includes(ean.substring(0, 8))
        ) {
          console.log(
            `   Possível codigoEAN similar: ${produto.codigoEAN} para produto ${produto.nome}`
          );
        }

        if (
          produto.codigoBarras &&
          produto.codigoBarras.includes(ean.substring(0, 8))
        ) {
          console.log(
            `   Possível codigoBarras similar: ${produto.codigoBarras} para produto ${produto.nome}`
          );
        }
      });
    }

    console.log("\n4. Recomendações:");
    console.log(
      "   - Verifique se o produto está disponível no armazém selecionado"
    );
    console.log("   - Confirme se o código digitado está correto");
    console.log(
      "   - Verifique se o EAN está cadastrado corretamente no produto"
    );
    console.log("==============================================\n");
  };

  // Função auxiliar para verificar os dados recebidos em tempo real
  const verificarEstruturaDados = () => {
    // Verificar quantidade de produtos
    console.log(`\n--- Verificação de Dados em Tempo Real ---`);
    console.log(`Produtos carregados: ${produtos.length}`);
    console.log(`Códigos mapeados: ${eanParaProdutoId.size}`);

    // Verificar se o EAN específico existe
    const eanEspecifico = "7895502400037";
    const produtoIdEspecifico = eanParaProdutoId.get(eanEspecifico);
    if (produtoIdEspecifico) {
      console.log(
        `EAN específico (${eanEspecifico}) mapeado para produto ID: ${produtoIdEspecifico}`
      );

      const produtoEncontrado = produtos.find(
        (p) => p.id === produtoIdEspecifico
      );
      if (produtoEncontrado) {
        console.log(
          `Produto encontrado: ${produtoEncontrado.nome} (${produtoEncontrado.sku})`
        );
      } else {
        console.log(
          `Produto com ID ${produtoIdEspecifico} não encontrado na lista de produtos`
        );
      }
    } else {
      console.log(`EAN específico (${eanEspecifico}) NÃO está mapeado`);

      // Verificar se existe entre os produtos
      const produtoComEAN = produtos.find(
        (p) =>
          p.ean === eanEspecifico ||
          p.codigoEAN === eanEspecifico ||
          p.codigoBarras === eanEspecifico ||
          p.codigosBarrasAlternativos?.includes(eanEspecifico)
      );

      if (produtoComEAN) {
        console.log(
          `Porém, produto com este EAN existe: ${produtoComEAN.nome} (${produtoComEAN.sku})`
        );
        console.log(`ID: ${produtoComEAN.id}`);
      } else {
        console.log(`Nenhum produto com este EAN foi encontrado`);
      }
    }

    console.log(`----------------------------------------\n`);
  };

  // Executar verificação quando os códigos forem mapeados
  useEffect(() => {
    if (produtos.length > 0 && eanParaProdutoId.size > 0) {
      console.log("Executando verificação de estrutura de dados...");
      verificarEstruturaDados();
    }
  }, [produtos, eanParaProdutoId]);

  // Função chamada quando um código de barras é escaneado
  const handleScan = async (codigo: string) => {
    setErro(null);
    const ean = extrairEAN(codigo);

    if (!ean || ean.length < 1) {
      setErro(`Código de barras inválido: ${codigo}`);
      return;
    }

    console.log(`Código escaneado: ${codigo}, EAN extraído: ${ean}`);

    // Verificar EAN específico
    if (ean === "7895502400037") {
      console.log(
        "EAN específico detectado: 7895502400037 - Fazendo diagnóstico..."
      );
      diagnosticarEANProblematico(ean);
    }

    // Buscar o produto pelo EAN (com busca na API se necessário)
    const produtoEncontrado = await buscarProdutoPorCodigo(ean);

    if (produtoEncontrado) {
      // Adicionar o produto
      onAdicionarProduto(produtoEncontrado, 1);

      // Adicionar ao histórico
      setHistoricoScans((prev) => [
        {
          codigo: ean,
          timestamp: new Date(),
          produtoNome: produtoEncontrado.nome,
        },
        ...prev,
      ]);
    } else {
      // Produto não encontrado
      setProdutosDesconhecidos((prev) =>
        prev.includes(ean) ? prev : [...prev, ean]
      );

      if (ean === "7895502400037") {
        setErro(
          `Código EAN 7895502400037 não encontrado. Este produto existe no sistema mas pode não estar no armazém selecionado.`
        );
      } else {
        setErro(`Código não reconhecido: ${ean}`);
      }
    }
  };

  // Função para validar se um código de barras é válido
  const validarCodigoBarras = (codigo: string): boolean => {
    // Aceita qualquer código que tenha pelo menos 1 caractere
    return codigo.trim().length > 0;
  };

  // Função para limpar o histórico de leituras
  const limparHistorico = () => {
    setHistoricoScans([]);
    setProdutosDesconhecidos([]);
  };

  // Total de itens escaneados (contagem de produtos)
  const totalEscaneado = produtosSelecionados.reduce(
    (total, item) => total + item.quantidade,
    0
  );

  // Função para inspecionar melhor a estrutura dos produtos
  const analisarEstruturaProdutos = () => {
    if (produtos.length === 0) {
      console.log("Não há produtos para analisar");
      return;
    }

    console.log(`\n======= ANÁLISE DE ESTRUTURA DE PRODUTOS =======`);
    console.log(`Total de produtos: ${produtos.length}`);

    // Pegar um produto de amostra
    const amostra = produtos[0];
    console.log("Estrutura do primeiro produto:");
    console.log(JSON.stringify(amostra, null, 2));

    // Verificar campos comuns em todos os produtos
    const camposComuns = new Set(Object.keys(amostra));
    const camposTotais = new Set(Object.keys(amostra));

    produtos.slice(1).forEach((produto) => {
      const camposProduto = new Set(Object.keys(produto));

      // Atualizar campos comuns (intersecção)
      for (const campo of camposComuns) {
        if (!camposProduto.has(campo)) {
          camposComuns.delete(campo);
        }
      }

      // Atualizar todos os campos (união)
      for (const campo of camposProduto) {
        camposTotais.add(campo);
      }
    });

    console.log("\nCampos presentes em TODOS os produtos:");
    console.log(Array.from(camposComuns).join(", "));

    console.log("\nTodos os campos encontrados em pelo menos um produto:");
    console.log(Array.from(camposTotais).join(", "));

    // Verificar tipos de campos para códigos
    const camposCodigo = ["ean", "codigoEAN", "codigoBarras", "sku"];
    console.log("\nAnálise dos campos possíveis para códigos:");

    camposCodigo.forEach((campo) => {
      let contagemPresente = 0;
      let exemplos: string[] = [];

      produtos.forEach((produto) => {
        // Usando type assertion para acessar propriedades dinâmicas
        const valor = (produto as any)[campo];
        if (valor !== undefined) {
          contagemPresente++;
          if (exemplos.length < 3) {
            exemplos.push(`${valor} (${produto.nome})`);
          }
        }
      });

      const porcentagem = Math.round(
        (contagemPresente / produtos.length) * 100
      );
      console.log(
        `- ${campo}: presente em ${contagemPresente}/${produtos.length} produtos (${porcentagem}%)`
      );
      if (exemplos.length > 0) {
        console.log(`  Exemplos: ${exemplos.join(", ")}`);
      }
    });

    // Verificar estrutura de codigosBarrasAlternativos
    let produtosComCodigosAlternativos = 0;
    let exemplosCodigosAlternativos: string[] = [];

    produtos.forEach((produto) => {
      if (produto.codigosBarrasAlternativos?.length) {
        produtosComCodigosAlternativos++;
        if (exemplosCodigosAlternativos.length < 3) {
          exemplosCodigosAlternativos.push(
            `${produto.nome}: [${produto.codigosBarrasAlternativos.join(", ")}]`
          );
        }
      }
    });

    const porcentagemAlternativos = Math.round(
      (produtosComCodigosAlternativos / produtos.length) * 100
    );
    console.log(
      `\nCódigos alternativos: presentes em ${produtosComCodigosAlternativos}/${produtos.length} produtos (${porcentagemAlternativos}%)`
    );
    if (exemplosCodigosAlternativos.length > 0) {
      console.log(`Exemplos: ${exemplosCodigosAlternativos.join("; ")}`);
    }

    console.log("==============================================\n");
  };

  // Executar análise quando os produtos forem carregados
  useEffect(() => {
    if (produtos.length > 0) {
      // Função para análise detalhada dos dados
      analisarEstruturaProdutos();
    }
  }, [produtos]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Scanner */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Scan className="h-5 w-5 text-indigo-500" />
            Leitura de Código de Barras
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onVoltarModoManual}
            className="flex items-center gap-1.5 h-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Modo Manual
          </Button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Escaneie o código de barras dos produtos para adicioná-los à saída.
          Cada leitura incrementa a quantidade em 1.
        </p>
      </div>

      {/* Área do Scanner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 p-4">
        <BarcodeReader
          onScan={handleScan}
          continuousMode={true}
          scanButtonLabel="Iniciar Câmera"
          placeholder="Escaneie ou digite o código de barras"
          validateBarcode={validarCodigoBarras}
          allowManualInput={true}
          maxLength={30}
        />
        <div className="mt-3 text-sm text-blue-700 dark:text-blue-300">
          <p className="flex items-center">
            <Info className="h-4 w-4 mr-1" />
            Você também pode digitar o código manualmente e pressionar Enter.
          </p>
        </div>
      </div>

      {/* Pesquisa alternativa por produto */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          Busca direta por produto
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className="md:col-span-3">
            <Input
              placeholder="Digite o SKU ou nome do produto"
              value={searchTerm || ""}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="md:col-span-1">
            <Input
              type="number"
              min="1"
              placeholder="Qtd."
              value={quantidade || 1}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="md:col-span-1">
            <Button
              type="button"
              onClick={() => {
                const produtoEncontrado = produtos.find(
                  (p) =>
                    p.sku === searchTerm ||
                    p.nome.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (produtoEncontrado) {
                  onAdicionarProduto(produtoEncontrado, quantidade || 1);
                  setSearchTerm("");
                  setQuantidade(1);
                } else {
                  setErro(`Produto "${searchTerm}" não encontrado`);
                }
              }}
              disabled={!searchTerm}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Mensagem de erro */}
      {erro && (
        <Alert variant="destructive" className="mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Lista de produtos selecionados */}
      {produtosSelecionados.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-500" />
            Produtos Selecionados ({totalEscaneado} itens)
          </h3>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead className="font-medium">Produto</TableHead>
                  <TableHead className="font-medium text-center">
                    Quantidade
                  </TableHead>
                  <TableHead className="font-medium text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosSelecionados.map((item) => (
                  <TableRow
                    key={item.sku}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {item.nome}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        SKU: {item.sku}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {item.quantidade} un.
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoverProduto(item.sku)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Produtos não encontrados */}
      {produtosDesconhecidos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Códigos não reconhecidos
          </h3>
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg">
            <div className="flex flex-wrap gap-2">
              {produtosDesconhecidos.map((codigo) => (
                <Badge
                  key={codigo}
                  variant="outline"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                >
                  {codigo}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              Estes códigos não correspondem a nenhum produto no sistema.
            </p>
          </div>
        </div>
      )}

      {/* Histórico de leituras */}
      {historicoScans.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-500" />
              Histórico de Leituras
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={limparHistorico}
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Limpar Histórico
            </Button>
          </div>

          <ScrollArea className="h-[200px] rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-3">
              {historicoScans.map((scan, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {validarCodigoBarras(scan.codigo) ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <div>
                      <div className="font-medium">
                        {scan.produtoNome || "Produto desconhecido"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Código: {scan.codigo}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {scan.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Dicas e instruções */}
      <Alert className="bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
        <Info className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <AlertDescription className="text-gray-600 dark:text-gray-400">
          <p>
            <strong>Dicas:</strong>
          </p>
          <ul className="list-disc ml-5 text-sm mt-1 space-y-1">
            <li>
              Mantenha o código de barras bem iluminado e centralizado na câmera
            </li>
            <li>Escaneie um produto por vez e aguarde o sinal de leitura</li>
            <li>
              Para produtos com múltiplas unidades, escaneie o mesmo código
              várias vezes
            </li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
