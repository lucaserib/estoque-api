import { useState } from "react";

const Fornecedores = () => {
  const [nome, setNome] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const fornecedor = { nome, inscricaoEstadual, cnpj };

    try {
      const response = await fetch("/api/fornecedores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fornecedor),
      });

      if (response.ok) {
        setMessage("Fornecedor cadastrado com sucesso!");
        setMessageType("success");
        setNome("");
        setInscricaoEstadual("");
        setCnpj("");
      } else {
        setMessage("Erro ao cadastrar fornecedor.");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao cadastrar fornecedor:", error);
      setMessage("Erro ao cadastrar fornecedor.");
      setMessageType("error");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Cadastrar Fornecedor
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nome
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Inscrição Estadual
          </label>
          <input
            type="text"
            value={inscricaoEstadual}
            onChange={(e) => setInscricaoEstadual(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            CPF/CNPJ
          </label>
          <input
            type="text"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Cadastrar Fornecedor
        </button>
      </form>
      {message && (
        <p
          className={`mt-4 text-center ${
            messageType === "success" ? "text-green-500" : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default Fornecedores;
