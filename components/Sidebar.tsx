import React, { useState } from "react";
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
  FaBars,
  FaTimes,
} from "react-icons/fa";
import DarkModeToggle from "./DarkModeToggle";

export const Sidebar = () => {
  const [isFornecedoresOpen, setIsFornecedoresOpen] = useState(false);
  const [isPedidosOpen, setIsPedidosOpen] = useState(false);
  const [isProdutosOpen, setIsProdutosOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaidasOpen, setIsSaidasOpen] = useState(false);
  const [isEstoqueOpen, setIsEstoqueOpen] = useState(false);

  const toggleFornecedores = () => setIsFornecedoresOpen(!isFornecedoresOpen);
  const togglePedidos = () => setIsPedidosOpen(!isPedidosOpen);
  const toggleProdutos = () => setIsProdutosOpen(!isProdutosOpen);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleSaidas = () => setIsSaidasOpen(!isSaidasOpen);
  const toggleEstoque = () => setIsEstoqueOpen(!isEstoqueOpen);

  return (
    <>
      <button
        className="md:hidden p-3 text-white bg-blue-900 dark:bg-gray-900 fixed top-4 left-4 z-50"
        onClick={toggleSidebar}
      >
        {isSidebarOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
      </button>

      <div
        className={`w-64 h-screen bg-blue-900 dark:bg-gray-900 text-white p-4 flex flex-col justify-between fixed z-40 transition-transform transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="overflow-y-auto flex-grow">
          <h2 className="text-3xl font-bold mb-8">Gestão de Estoque</h2>
          <ul className="space-y-4">
            <li>
              <Link href="/" legacyBehavior>
                <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                  <FaHome className="mr-3" />
                  Home
                </a>
              </Link>
            </li>
            <li>
              <button
                onClick={togglePedidos}
                className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left text-white dark:text-gray-300"
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
                <ul className="pl-4 space-y-2">
                  <li>
                    <Link href="/pedidos/novo" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Novo Pedido
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href="/pedidos/pendentes" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Pedidos Pendentes
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href="/pedidos/concluidos" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Pedidos Concluídos
                      </a>
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            {/* Fornecedores Section */}
            <li>
              <button
                onClick={toggleFornecedores}
                className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left text-white dark:text-gray-300"
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
                <ul className="pl-4 space-y-2">
                  <li>
                    <Link
                      href="/fornecedores/exibirFornecedores"
                      legacyBehavior
                    >
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Listar Fornecedores
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href="/fornecedores/fornecedores" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Cadastrar Fornecedor
                      </a>
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            {/* Produtos Section */}
            <li>
              <button
                onClick={toggleProdutos}
                className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left text-white dark:text-gray-300"
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
                <ul className="pl-4 space-y-2">
                  <li>
                    <Link href="/produtos/cadastrarProduto" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Cadastrar Produto
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href="/produtos/listarProdutos" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Listar Produtos
                      </a>
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            {/* Estoque Section */}
            <li>
              <button
                onClick={toggleEstoque}
                className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left text-white dark:text-gray-300"
              >
                <FaWarehouse className="mr-3" />
                Estoque
                {isEstoqueOpen ? (
                  <FaChevronUp className="ml-auto" />
                ) : (
                  <FaChevronDown className="ml-auto" />
                )}
              </button>
              {isEstoqueOpen && (
                <ul className="pl-4 space-y-2">
                  <li>
                    <Link href="/estoque/criarArmazem" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Criar Armazéns
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href="/estoque/armazens" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Armazens
                      </a>
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <button
                onClick={() => setIsSaidasOpen(!isSaidasOpen)}
                className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left text-white dark:text-gray-300"
              >
                <FaTruck className="mr-3" />
                Saídas
                {isSaidasOpen ? (
                  <FaChevronUp className="ml-auto" />
                ) : (
                  <FaChevronDown className="ml-auto" />
                )}
              </button>
              {isSaidasOpen && (
                <ul className="pl-4 space-y-2">
                  <li>
                    <Link href="/saidas/novaSaida" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Nova Saída
                      </a>
                    </Link>
                  </li>
                  <li>
                    <Link href="/saidas/registroSaidas" legacyBehavior>
                      <a className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300">
                        Listar Saídas
                      </a>
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </div>

        {/* Dark Mode Toggle */}
        <div className="mt-auto">
          <DarkModeToggle />
        </div>
      </div>
    </>
  );
};
