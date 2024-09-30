import { useEffect, useState } from "react";

interface Produto {
  id: number;
  nome: string;
  sku: string;
}

interface PedidoProduto {
  produtoId: number;
  quantidade: number;
  custo: number;
  produto: Produto;
}

interface Pedido {
  id: number;
  armazemId: number;
  produtos: PedidoProduto[];
  status: string;
}

const Estoque = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [armazemSelecionado, setArmazemSelecionado] = useState<number | null>(
    null
  );

  useEffect(() => {
    const fetchPedidos = async () => {
      try {
        const response = await fetch("/api/pedidos-compra");
        const data = await response.json();
        setPedidos(
          data.filter((pedido: Pedido) => pedido.status === "confirmado")
        );
      } catch (error) {
        setError("Erro ao buscar pedidos");
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
  }, []);

  const armazensUnicos = Array.from(
    new Set(pedidos.map((pedido) => pedido.armazemId))
  );

  const produtosPorArmazem = (armazemId: number) => {
    const produtosMap = new Map<
      number,
      { produto: Produto; quantidade: number; custoTotal: number }
    >();

    pedidos
      .filter((pedido) => pedido.armazemId === armazemId)
      .forEach((pedido) => {
        pedido.produtos.forEach((pedidoProduto) => {
          if (produtosMap.has(pedidoProduto.produtoId)) {
            const produtoInfo = produtosMap.get(pedidoProduto.produtoId)!;
            produtoInfo.quantidade += pedidoProduto.quantidade;
            produtoInfo.custoTotal +=
              pedidoProduto.custo * pedidoProduto.quantidade;
          } else {
            produtosMap.set(pedidoProduto.produtoId, {
              produto: pedidoProduto.produto,
              quantidade: pedidoProduto.quantidade,
              custoTotal: pedidoProduto.custo * pedidoProduto.quantidade,
            });
          }
        });
      });

    return Array.from(produtosMap.values());
  };

  if (loading) {
    return <p className="text-center mt-10">Carregando...</p>;
  }

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Estoque
      </h1>
      <div className="mb-4">
        <label
          htmlFor="armazem"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Selecione o Armazém
        </label>
        <select
          id="armazem"
          name="armazem"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          onChange={(e) => setArmazemSelecionado(Number(e.target.value))}
        >
          <option value="">Selecione um armazém</option>
          {armazensUnicos.map((armazemId) => (
            <option key={armazemId} value={armazemId}>
              Armazém {armazemId}
            </option>
          ))}
        </select>
      </div>
      {armazemSelecionado && (
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Produtos no Armazém {armazemSelecionado}
          </h2>
          <ul className="space-y-4">
            {produtosPorArmazem(armazemSelecionado).map(
              ({ produto, quantidade, custoTotal }) => (
                <li
                  key={produto.id}
                  className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-700 rounded-md shadow-sm"
                >
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {produto.nome}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      SKU: {produto.sku}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Quantidade: {quantidade}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Média do valor pago:{" "}
                      {(custoTotal / quantidade).toFixed(2)}
                    </p>
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Estoque;
