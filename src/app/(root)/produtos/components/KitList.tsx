// app/produtos/components/KitList.tsx
"use client";
import { useState } from "react";
import { useFetch } from "@/app/hooks/useFetch";
import { Kit } from "../types";
import { FaTrash, FaEdit, FaEye, FaWarehouse, FaSpinner } from "react-icons/fa";

const KitList = () => {
  const { data: kits, loading, error } = useFetch<Kit>("/api/kits");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const itemsPerPage = 10;

  if (loading) {
    return (
      <p className="text-gray-500 dark:text-gray-400 text-center">
        Carregando kits...
      </p>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center">{error}</p>;
  }

  const filteredKits = (kits ?? []).filter(
    (kit) =>
      kit.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kit.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastKit = currentPage * itemsPerPage;
  const indexOfFirstKit = indexOfLastKit - itemsPerPage;
  const currentKits = filteredKits.slice(indexOfFirstKit, indexOfLastKit);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div>
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 20 20"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
            />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Pesquisar por nome ou SKU"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 pl-10 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Nome
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  SKU
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  EAN
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Componentes
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {currentKits.length > 0 ? (
                currentKits.map((kit) => (
                  <tr
                    key={kit.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {kit.nome}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {kit.sku}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {kit.ean || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                          {kit.componentes.length} itens
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setSelectedKit(kit);
                            setShowDetailsModal(true);
                          }}
                          className="text-blue-500 hover:text-blue-700 transition-colors duration-150"
                          title="Ver detalhes"
                        >
                          <FaEye className="w-5 h-5" />
                        </button>
                        <button
                          className="text-green-500 hover:text-green-700 transition-colors duration-150"
                          title="Editar kit"
                        >
                          <FaEdit className="w-5 h-5" />
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 transition-colors duration-150"
                          title="Excluir kit"
                        >
                          <FaTrash className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Nenhum kit encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredKits.length > itemsPerPage && (
        <div className="flex justify-center items-center space-x-1 mt-6">
          <button
            onClick={() => paginate(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          {Array.from(
            {
              length: Math.min(
                5,
                Math.ceil(filteredKits.length / itemsPerPage)
              ),
            },
            (_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => paginate(pageNum)}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {pageNum}
                </button>
              );
            }
          )}
          {Math.ceil(filteredKits.length / itemsPerPage) > 5 && (
            <span className="px-2 text-gray-500">...</span>
          )}
          <button
            onClick={() =>
              paginate(
                Math.min(
                  Math.ceil(filteredKits.length / itemsPerPage),
                  currentPage + 1
                )
              )
            }
            disabled={
              currentPage === Math.ceil(filteredKits.length / itemsPerPage)
            }
            className="px-3 py-1 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próxima
          </button>
        </div>
      )}

      {/* Modal de Detalhes do Kit */}
      {showDetailsModal && selectedKit && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-sm"></div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-11/12 max-w-md max-h-[80vh] overflow-y-auto relative animate-fade-in">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Detalhes do Kit
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold text-gray-700 dark:text-gray-300">
                  Nome:
                </div>
                <div className="col-span-2 text-gray-900 dark:text-gray-100">
                  {selectedKit.nome}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold text-gray-700 dark:text-gray-300">
                  SKU:
                </div>
                <div className="col-span-2 text-gray-900 dark:text-gray-100">
                  {selectedKit.sku}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 font-semibold text-gray-700 dark:text-gray-300">
                  EAN:
                </div>
                <div className="col-span-2 text-gray-900 dark:text-gray-100">
                  {selectedKit.ean || "N/A"}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mt-4 mb-2">
                  Componentes:
                </h3>
                {selectedKit.componentes.length > 0 ? (
                  <ul className="space-y-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                    {selectedKit.componentes.map((componente, index) => (
                      <li
                        key={index}
                        className="text-sm flex justify-between items-center py-2 border-b last:border-0 border-gray-200 dark:border-gray-600"
                      >
                        <span className="text-gray-800 dark:text-gray-200">
                          Produto ID: {componente.produtoId}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          Qtd: {componente.quantidade}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Sem componentes.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors duration-150"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitList;
