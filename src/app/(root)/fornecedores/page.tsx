"use client";
import { useState, useEffect } from "react";
import {
  PlusCircle,
  Search,
  Trash2,
  X,
  Phone,
  MapPin,
  Building,
  CreditCard,
  Pencil,
  LucideLoader2,
  Package,
} from "lucide-react";
import { useLayout } from "@/app/context/LayoutContext";
import { useFetch } from "@/app/hooks/useFetch";
import { Fornecedor } from "./types";
import Header from "@/app/components/Header";
import { toast } from "sonner";
import { FornecedorEditDialog } from "@/components/FornecedorEditDialog";
import { FornecedorProdutoDialog } from "@/app/components/FornecedorProdutoDialog";
import {
  exportToExcel,
  formatFornecedoresForExport,
} from "@/utils/excelExport";
import { ExportButton } from "@/components/ExportButton";
import { Button } from "@/components/ui/button";

const FornecedoresPage = () => {
  const { isSidebarCollapsed } = useLayout();
  const {
    data: initialFornecedores,
    loading,
    error,
  } = useFetch<Fornecedor[]>("/api/fornecedores");
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fornecedorToDelete, setFornecedorToDelete] =
    useState<Fornecedor | null>(null);
  const [deleteVinculos, setDeleteVinculos] = useState<{
    hasOrders: boolean;
    hasProducts: boolean;
  } | null>(null);

  const [nome, setNome] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contato, setContato] = useState("");
  const [endereco, setEndereco] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formMessageType, setFormMessageType] = useState<
    "success" | "error" | ""
  >("");
  const [fornecedorParaProdutos, setFornecedorParaProdutos] =
    useState<Fornecedor | null>(null);

  const [fornecedorToEdit, setFornecedorToEdit] = useState<Fornecedor | null>(
    null
  );

  // Estado para controlar os fornecedores selecionados
  const [selectedFornecedores, setSelectedFornecedores] = useState<string[]>(
    []
  );

  useEffect(() => {
    if (initialFornecedores) {
      setFornecedores(initialFornecedores);
    }
  }, [initialFornecedores]);

  // Limpar seleções quando o termo de busca muda
  useEffect(() => {
    setSelectedFornecedores([]);
  }, [searchTerm]);

  const filteredFornecedores = fornecedores?.filter(
    (fornecedor) =>
      fornecedor.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fornecedor.cnpj.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fornecedor.contato.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();

    const fornecedor = { nome, inscricaoEstadual, cnpj, contato, endereco };

    try {
      const response = await fetch("/api/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fornecedor),
      });

      if (response.ok) {
        const newFornecedor = await response.json();
        setFornecedores((prev) => [...prev, newFornecedor]);
        setFormMessage("Fornecedor cadastrado com sucesso!");
        setFormMessageType("success");

        setNome("");
        setInscricaoEstadual("");
        setCnpj("");
        setContato("");
        setEndereco("");

        setTimeout(() => {
          setIsModalOpen(false);
          setFormMessage("");
        }, 1500);
      } else {
        setFormMessage("Erro ao cadastrar fornecedor.");
        setFormMessageType("error");
      }
    } catch (error) {
      console.error("Erro ao cadastrar fornecedor:", error);
      setFormMessage("Erro ao cadastrar fornecedor.");
      setFormMessageType("error");
    }
  };
  const handleExportFornecedores = () => {
    if (!fornecedores || fornecedores.length === 0) {
      toast.error("Não há fornecedores para exportar");
      return;
    }

    try {
      const formattedData = formatFornecedoresForExport(fornecedores);
      exportToExcel(
        formattedData as unknown as Record<string, unknown>[],
        "fornecedores_export",
        "Fornecedores"
      );
      toast.success("Exportação concluída com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar dados");
      console.error(error);
    }
  };

  // Função para exportar apenas os fornecedores selecionados
  const handleExportSelectedFornecedores = () => {
    if (selectedFornecedores.length === 0) {
      toast.warning("Selecione pelo menos um fornecedor para exportar");
      return;
    }

    try {
      const fornecedoresParaExportar = fornecedores.filter((fornecedor) =>
        selectedFornecedores.includes(String(fornecedor.id))
      );
      const formattedData = formatFornecedoresForExport(
        fornecedoresParaExportar
      );
      exportToExcel(
        formattedData as unknown as Record<string, unknown>[],
        "fornecedores_selecionados_export",
        "Fornecedores Selecionados"
      );
      toast.success(
        `${selectedFornecedores.length} fornecedores exportados com sucesso`
      );
    } catch (error) {
      toast.error("Erro ao exportar dados");
      console.error(error);
    }
  };

  // Função para selecionar/deselecionar um fornecedor
  const toggleFornecedorSelection = (id: string) => {
    setSelectedFornecedores((prev) =>
      prev.includes(id)
        ? prev.filter((fornecedorId) => fornecedorId !== id)
        : [...prev, id]
    );
  };

  // Função para selecionar/deselecionar todos os fornecedores
  const toggleSelectAllFornecedores = () => {
    if (selectedFornecedores.length === filteredFornecedores.length) {
      setSelectedFornecedores([]);
    } else {
      setSelectedFornecedores(
        filteredFornecedores.map((fornecedor) => String(fornecedor.id))
      );
    }
  };

  const handleDeleteFornecedor = async (id: string) => {
    try {
      const response = await fetch(`/api/fornecedores?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          const confirmDelete = window.confirm(
            "Este fornecedor possui vínculos com pedidos ou produtos. Deseja excluir mesmo assim? Isso removerá todos os vínculos."
          );

          if (confirmDelete) {
            const forceResponse = await fetch(
              `/api/fornecedores?id=${id}&force=true`,
              {
                method: "DELETE",
              }
            );

            if (!forceResponse.ok) {
              throw new Error("Erro ao excluir fornecedor");
            }

            setFornecedores((prev) =>
              prev.filter((f) => f.id.toString() !== id)
            );
            toast.success(
              "O fornecedor e seus vínculos foram excluídos com sucesso."
            );
          }
        } else {
          throw new Error(data.error || "Erro ao excluir fornecedor");
        }
      } else {
        setFornecedores((prev) => prev.filter((f) => f.id.toString() !== id));
        toast.success("O fornecedor foi excluído com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao excluir fornecedor:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir fornecedor"
      );
    }
  };

  const handleEditFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorToEdit(fornecedor);
  };

  const handleSaveFornecedor = (updatedFornecedor: Fornecedor) => {
    setFornecedores((prev) =>
      prev.map((f) => (f.id === updatedFornecedor.id ? updatedFornecedor : f))
    );
    setFornecedorToEdit(null);
  };

  return (
    <div className={`flex-1 transition-all duration-300`}>
      <main className="max-w-6xl mx-auto p-6 ">
        <Header name="Gestão de Fornecedores" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 mb-8 gap-4">
          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="Buscar fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400 h-5 w-5" />
          </div>

          <div className="flex items-center gap-2">
            <ExportButton
              onClick={handleExportFornecedores}
              label="Exportar Todos"
            />

            {selectedFornecedores.length > 0 && (
              <ExportButton
                onClick={handleExportSelectedFornecedores}
                label={`Exportar ${selectedFornecedores.length} Selecionados`}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              />
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <PlusCircle size={20} />
                <span>Novo Fornecedor</span>
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-6 text-gray-500">
            <LucideLoader2 className="h-6 w-6 animate-spin text-primary " />
            <span className="ml-2 text-muted-foreground">
              Carregando fornecedores...
            </span>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : fornecedores?.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Building className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Nenhum fornecedor cadastrado
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Comece adicionando seu primeiro fornecedor ao sistema.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <PlusCircle size={18} />
              <span>Adicionar Fornecedor</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cabeçalho com checkbox "Selecionar todos" */}
            <div className="flex items-center gap-3 mb-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={
                    selectedFornecedores.length ===
                      filteredFornecedores.length &&
                    filteredFornecedores.length > 0
                  }
                  onChange={toggleSelectAllFornecedores}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Selecionar todos</span>
              </div>

              <div className="flex-1 text-right text-sm text-gray-500">
                {filteredFornecedores.length} fornecedor
                {filteredFornecedores.length !== 1 ? "es" : ""} encontrado
                {filteredFornecedores.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Contador de selecionados */}
            {selectedFornecedores.length > 0 && (
              <div className="flex justify-between items-center py-2 px-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-md text-indigo-700 dark:text-indigo-300">
                <span>
                  {selectedFornecedores.length} fornecedor
                  {selectedFornecedores.length !== 1 ? "es" : ""} selecionado
                  {selectedFornecedores.length !== 1 ? "s" : ""}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedFornecedores([])}
                  className="h-8 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpar seleção
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {filteredFornecedores.map((fornecedor) => (
                <div
                  key={fornecedor.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start p-4 relative">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedFornecedores.includes(
                            String(fornecedor.id)
                          )}
                          onChange={() =>
                            toggleFornecedorSelection(String(fornecedor.id))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {fornecedor.nome}
                        </h3>
                      </div>
                      <div className="mt-2 space-y-1.5 pl-6">
                        {fornecedor.cnpj && (
                          <p className="text-sm flex items-center text-gray-600 dark:text-gray-300">
                            <CreditCard className="h-3.5 w-3.5 mr-2 text-gray-400" />
                            CNPJ: {fornecedor.cnpj}
                          </p>
                        )}
                        {fornecedor.inscricaoEstadual && (
                          <p className="text-sm flex items-center text-gray-600 dark:text-gray-300">
                            <Building className="h-3.5 w-3.5 mr-2 text-gray-400" />
                            Inscrição Estadual: {fornecedor.inscricaoEstadual}
                          </p>
                        )}
                        {fornecedor.contato && (
                          <p className="text-sm flex items-center text-gray-600 dark:text-gray-300">
                            <Phone className="h-3.5 w-3.5 mr-2 text-gray-400" />
                            Contato: {fornecedor.contato}
                          </p>
                        )}
                        {fornecedor.endereco && (
                          <p className="text-sm flex items-center text-gray-600 dark:text-gray-300">
                            <MapPin className="h-3.5 w-3.5 mr-2 text-gray-400" />
                            Endereço: {fornecedor.endereco}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                      <button
                        onClick={() => handleEditFornecedor(fornecedor)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => setFornecedorParaProdutos(fornecedor)}
                        className="flex items-center gap-1 text-purple-600 hover:text-purple-800 dark:text-purple-500 dark:hover:text-purple-400 transition-colors"
                      >
                        <Package className="h-4 w-4" />
                        <span>Produtos</span>
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteFornecedor(fornecedor.id.toString())
                        }
                        className="flex items-center gap-1 text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 backdrop-blur-sm transition-opacity"
              onClick={() => setIsModalOpen(false)}
            ></div>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="px-6 pt-6 pb-8">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mb-6">
                  Cadastrar Novo Fornecedor
                </h3>

                <form onSubmit={handleAddFornecedor} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                      className="w-full p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Inscrição Estadual
                    </label>
                    <input
                      type="text"
                      value={inscricaoEstadual}
                      onChange={(e) => setInscricaoEstadual(e.target.value)}
                      className="w-full p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      CNPJ
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      className="w-full p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Contato
                    </label>
                    <input
                      type="text"
                      value={contato}
                      onChange={(e) => setContato(e.target.value)}
                      className="w-full p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="w-full p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {formMessage && (
                    <div
                      className={`py-2 px-3 rounded-md ${
                        formMessageType === "success"
                          ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                          : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formMessage}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Cadastrar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {fornecedorParaProdutos && (
        <FornecedorProdutoDialog
          isOpen={!!fornecedorParaProdutos}
          onClose={() => setFornecedorParaProdutos(null)}
          fornecedor={fornecedorParaProdutos}
        />
      )}

      {fornecedorToEdit && (
        <FornecedorEditDialog
          isOpen={!!fornecedorToEdit}
          onClose={() => setFornecedorToEdit(null)}
          fornecedor={fornecedorToEdit}
          onSave={handleSaveFornecedor}
        />
      )}
    </div>
  );
};

export default FornecedoresPage;
