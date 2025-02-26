"use client";
import { useState } from "react";

interface EditarProdutoModalProps {
  produto: {
    id: number;
    nome: string;
    sku: string;
    ean?: string;
  };
  onClose: () => void;
  onSave: (produto: {
    id: number;
    nome: string;
    sku: string;
    ean: string;
  }) => void;
}

const EditarProdutoModal = ({
  produto,
  onClose,
  onSave,
}: EditarProdutoModalProps) => {
  const [nome, setNome] = useState(produto.nome);
  const [sku, setSku] = useState(produto.sku);
  const [ean, setEan] = useState(produto.ean);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/produtos`, {
        method: "PUT",
        headers: {
          "Content-Type": "applications/json",
        },
        body: JSON.stringify({
          id: produto.id,
          nome,
          sku,
          ean,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar as alterações");
      }
      const produtoAtualizado = await response.json();
      onSave(produtoAtualizado);
      onClose();
    } catch (error) {
      setError("Erro ao salvar as alterações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-11/12 max-w-md">
        <h2 className="text-xl font-bold mb-4">Editar Produto</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              SKU
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              EAN
            </label>
            <input
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditarProdutoModal;
