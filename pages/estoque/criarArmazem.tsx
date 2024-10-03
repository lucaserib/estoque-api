import { useEffect, useState } from "react";

interface Armazem {
  id: number;
  nome: string;
}

const CriarArmazem = () => {
  const [nome, setNome] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [armazens, setArmazens] = useState<Armazem[]>([]);

  const fetchArmazens = async () => {
    try {
      const response = await fetch("/api/estoque/criarArmazem");
      const data = await response.json();
      setArmazens(data);
    } catch (error) {
      setMessage("Erro ao buscar armazéns");
      setMessageType("error");
    }
  };

  useEffect(() => {
    fetchArmazens();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/estoque/criarArmazem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nome }),
      });

      if (response.ok) {
        setMessage("Armazém criado com sucesso!");
        setMessageType("success");
        setNome("");
        fetchArmazens(); // Atualizar a lista de armazéns
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao criar armazém");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Erro ao criar armazém");
      setMessageType("error");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch("/api/estoque/armazens", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setMessage("Armazém deletado com sucesso!");
        setMessageType("success");
        fetchArmazens(); // Atualizar a lista de armazéns
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao deletar armazém");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Erro ao deletar armazém");
      setMessageType("error");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white dark:bg-gray-900 rounded-md shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Criar Armazém
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="nome"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Nome do Armazém
          </label>
          <input
            type="text"
            id="nome"
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
        </div>
        {message && (
          <p
            className={`text-center mt-4 ${
              messageType === "success" ? "text-green-500" : "text-red-500"
            }`}
          >
            {message}
          </p>
        )}
        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Criar Armazém
        </button>
      </form>

      <h2 className="text-xl font-bold mt-10 mb-4 text-gray-900 dark:text-gray-100">
        Armazéns Criados
      </h2>
      <ul className="space-y-4">
        {armazens.map((armazem) => (
          <li
            key={armazem.id}
            className="flex justify-between items-center p-4 bg-gray-100 dark:bg-gray-800 rounded-md shadow-md"
          >
            <span className="text-gray-900 dark:text-gray-100">
              {armazem.nome}
            </span>
            <button
              onClick={() => handleDelete(armazem.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Deletar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CriarArmazem;
