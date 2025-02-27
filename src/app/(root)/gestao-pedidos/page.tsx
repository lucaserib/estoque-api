"use client";
import { useState } from "react";
import { useLayout } from "@/app/context/LayoutContext";
import NovoPedido from "./components/novoPedido/page";
import PedidosPendentes from "./components/pedidosPendentes/page";
import PedidosConcluidos from "./components/concluidos/page";

const GestaoPedidos = () => {
  const { isSidebarCollapsed } = useLayout();
  const [activeTab, setActiveTab] = useState<
    "novo" | "pendentes" | "concluidos"
  >("novo");

  return (
    <div className="flex flex-col w-full min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 p-6 md:p-9">
        <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100 tracking-tight">
          Gestão de Pedidos
        </h1>
        <div className="flex flex-col sm:flex-row sm:space-x-6 mb-8 border-b border-gray-200 dark:border-gray-700 pb-2">
          {[
            { id: "novo", label: "Novo Pedido" },
            { id: "pendentes", label: "Pendentes" },
            { id: "concluidos", label: "Concluídos" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`relative px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? "text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 transition-all duration-300" />
              )}
            </button>
          ))}
        </div>
        <div className="transition-opacity duration-300">
          {activeTab === "novo" && <NovoPedido />}
          {activeTab === "pendentes" && <PedidosPendentes />}
          {activeTab === "concluidos" && <PedidosConcluidos />}
        </div>
      </div>
    </div>
  );
};

export default GestaoPedidos;
