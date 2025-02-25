"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLayout } from "@/app/context/LayoutContext";
import NovoPedido from "./components/novoPedido/page";
import PedidosPendentes from "./components/pedidosPendentes/page";
import PedidosConcluidos from "./components/concluidos/page";

const GestaoPedidos = () => {
  const { isSidebarCollapsed, isDarkMode } = useLayout();
  const [activeTab, setActiveTab] = useState<
    "novo" | "pendentes" | "concluidos"
  >("novo");

  return (
    <div className="flex flex-col w-full min-h-screen">
      <div className="bg-gray-50 dark:bg-gray-900 flex-1 p-6 md:p-9">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Gestão de Pedidos
        </h1>

        <div className="flex flex-col sm:flex-row sm:space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: "novo", label: "Novo Pedido" },
            { id: "pendentes", label: "Pendentes" },
            { id: "concluidos", label: "Concluídos" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all" />
              )}
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all duration-300">
          {activeTab === "novo" && <NovoPedido />}
          {activeTab === "pendentes" && <PedidosPendentes />}
          {activeTab === "concluidos" && <PedidosConcluidos />}
        </div>
      </div>
    </div>
  );
};

export default GestaoPedidos;
