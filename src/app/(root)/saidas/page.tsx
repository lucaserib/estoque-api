// app/saidas/page.tsx
"use client";
import { useState } from "react";
import { FaPlusCircle } from "react-icons/fa";
import SaidaList from "./components/SaidaList";
import NovaSaidaModal from "./components/NovaSaidaModal";

const SaidasPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const handleSave = () => {
    setRefresh((prev) => prev + 1); // Forçar refetch após salvar
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Registro de Saídas
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <FaPlusCircle className="mr-2" /> Nova Saída
        </button>
      </div>
      <SaidaList />
      {showCreateModal && (
        <NovaSaidaModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default SaidasPage;
