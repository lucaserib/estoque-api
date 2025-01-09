"use client";
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
import DarkModeToggle from "../DarkModeToggle";

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
  const aClassname =
    "flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors text-white dark:text-gray-300";

  return (
    <>
      <button
        className="md:hidden p-3 text-white bg-blue-900 dark:bg-gray-900 fixed top-4 left-4 z-50 rounded-full shadow-lg"
        onClick={toggleSidebar}
      >
        {isSidebarOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
      </button>
      <div
        className={`w-64 h-screen bg-blue-900 dark:bg-gray-900 text-white p-4 flex flex-col justify-between fixed z-40 transition-transform transform shadow-lg ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex flex-col overflow-y-auto flex-grow">
          <h2 className="text-2xl font-semibold mb-8 text-center">
            Gestão de Estoque
          </h2>
          <ul className="space-y-4">
            <li>
              <Link href="/" className={aClassname}>
                <FaHome className="mr-3" />
                Home
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
                    <Link href="/pedidos/novo" className={aClassname}>
                      Novo Pedido
                    </Link>
                  </li>
                  <li>
                    <Link href="/pedidos/pendentes" className={aClassname}>
                      Pedidos Pendentes
                    </Link>
                  </li>
                  <li>
                    <Link href="/pedidos/concluidos" className={aClassname}>
                      Pedidos Concluídos
                    </Link>
                  </li>
                </ul>
              )}
            </li>
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
                      className={aClassname}
                    >
                      Listar Fornecedores
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/fornecedores/fornecedores"
                      className={aClassname}
                    >
                      Cadastrar Fornecedor
                    </Link>
                  </li>
                </ul>
              )}
            </li>
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
                    <Link
                      href="/produtos/cadastrarProdutos"
                      className={aClassname}
                    >
                      Cadastrar Produto
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/produtos/listarProdutos"
                      className={aClassname}
                    >
                      Listar Produtos
                    </Link>
                  </li>
                  <li>
                    <Link href="/produtos/listarKits" className={aClassname}>
                      Listar Kits
                    </Link>
                  </li>
                </ul>
              )}
            </li>
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
                    <Link href="/estoque/criarArmazem" className={aClassname}>
                      Criar Armazéns
                    </Link>
                  </li>
                  <li>
                    <Link href="/estoque/armazens" className={aClassname}>
                      Armazens
                    </Link>
                  </li>
                </ul>
              )}
            </li>
            <li>
              <button
                onClick={toggleSaidas}
                className="flex items-center py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 transition-colors w-full text-left text-white dark:text-gray-300"
              >
                <FaBox className="mr-3" />
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
                    <Link href="/saidas/novaSaida" className={aClassname}>
                      Nova Saída
                    </Link>
                  </li>
                  <li>
                    <Link href="/saidas/registroSaidas" className={aClassname}>
                      Registro de saídas
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
          <div className="mt-4">
            <DarkModeToggle />
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center"></div>
      </div>
    </>
  );
};

export default Sidebar;
