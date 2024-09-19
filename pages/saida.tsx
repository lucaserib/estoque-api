import React, { useState } from "react";

const Saida = () => {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(0);

  const handleRetirarProduto = () => {
    // Lógica para retirar o produto
    console.log(
      `Retirando ${quantity} unidades do produto com ID ${productId}`
    );
    // Aqui você pode adicionar a lógica para atualizar o estoque no backend
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Retirar Produtos</h1>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          ID do Produto
        </label>
        <input
          type="text"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Quantidade
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <button
        onClick={handleRetirarProduto}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Retirar Produto
      </button>
    </div>
  );
};

export default Saida;
