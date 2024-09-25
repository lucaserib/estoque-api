import { useState } from "react";
import Link from "next/link";
import {
  FaHome,
  FaClipboardList,
  FaBox,
  FaTruck,
  FaWarehouse,
  FaSignOutAlt,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import DarkModeToggle from "./DarkModeToggle";

export const Sidebar = () => {
  const [isFornecedoresOpen, setIsFornecedoresOpen] = useState(false);
  const [isPedidosOpen, setIsPedidosOpen] = useState(false);
  const [isProdutosOpen, setIsProdutosOpen] = useState(false);

  const toggleFornecedores = () => {
    setIsFornecedoresOpen(!isFornecedoresOpen);
  };

  const togglePedidos = () => {
    setIsPedidosOpen(!isPedidosOpen);
  };

  const toggleProdutos = () => {
    setIsProdutosOpen(!isProdutosOpen);
  };

  return (
    <div className="w-64 h-screen bg-blue-900 dark:bg-gray-900 text-white p-4 flex flex-col justify-between fixed">
      <div>
        <h2 className="text-3xl font-bold mb-8">Gestão de Estoque</h2>
        <ul className="space-y-4">
          <li>
            <Link href="/" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaHome className="mr-3" />
                Home
              </a>
            </Link>
          </li>
          <li>
            <button
              onClick={togglePedidos}
              className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left"
            >
              <FaClipboardList className="mr-3" />
              Pedidos de Compra
              {isPedidosOpen ? (
                <FaChevronUp className="ml-auto" />
              ) : (
                <FaChevronDown className="ml-auto" />
              )}
            </button>
            {isPedidosOpen && (
              <ul className="pl-4">
                <li>
                  <Link href="/pedidos/novo" legacyBehavior>
                    <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                      Novo Pedido
                    </a>
                  </Link>
                </li>
                <li>
                  <Link href="/pedidos/pendentes" legacyBehavior>
                    <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                      Pedidos Pendentes
                    </a>
                  </Link>
                </li>
                <li>
                  <Link href="/pedidos/concluidos" legacyBehavior>
                    <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                      Pedidos Concluídos
                    </a>
                  </Link>
                </li>
              </ul>
            )}
          </li>
          <li>
            <button
              onClick={toggleFornecedores}
              className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left"
            >
              <FaTruck className="mr-3" />
              Fornecedores
              {isFornecedoresOpen ? (
                <FaChevronUp className="ml-auto" />
              ) : (
                <FaChevronDown className="ml-auto" />
              )}
            </button>
            {isFornecedoresOpen && (
              <ul className="pl-4">
                <li>
                  <Link href="/fornecedores/exibirFornecedores" legacyBehavior>
                    <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                      Listar Fornecedores
                    </a>
                  </Link>
                </li>
                <li>
                  <Link href="/fornecedores/fornecedores" legacyBehavior>
                    <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                      Cadastrar Fornecedor
                    </a>
                  </Link>
                </li>
              </ul>
            )}
          </li>
          <li>
            <button
              onClick={toggleProdutos}
              className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left"
            >
              <FaBox className="mr-3" />
              Produtos
              {isProdutosOpen ? (
                <FaChevronUp className="ml-auto" />
              ) : (
                <FaChevronDown className="ml-auto" />
              )}
            </button>
            {isProdutosOpen && (
              <ul className="pl-4">
                <li>
                  <Link href="/produtos/cadastrarProduto" legacyBehavior>
                    <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                      Cadastrar Produto
                    </a>
                  </Link>
                </li>
                <li>
                  <Link href="/produtos/listarProdutos" legacyBehavior>
                    <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                      Listar Produtos
                    </a>
                  </Link>
                </li>
              </ul>
            )}
          </li>
          <li>
            <Link href="/estoque" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaWarehouse className="mr-3" />
                Estoque
              </a>
            </Link>
          </li>
          <li>
            <Link href="/saida" legacyBehavior>
              <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors">
                <FaSignOutAlt className="mr-3" />
                Saída
              </a>
            </Link>
          </li>
        </ul>
      </div>

      {/* Dark Mode Toggle */}
      <DarkModeToggle />
    </div>
  );
};
