// app/saidas/components/NovaSaidaModal.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { FaPlus, FaTrash, FaChevronDown } from "react-icons/fa";
import { useFetch } from "@/app/hooks/useFetch";
import { Produto, Armazem, SaidaProduto } from "../types";

interface NovaSaidaModalProps {
  onClose: () => void;
  onSave: () => void;
}

const NovaSaidaModal = ({ onClose, onSave }: NovaSaidaModalProps) => {
  const [sku, setSku] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [saidaProdutos, setSaidaProdutos] = useState<SaidaProduto[]>([]);
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: armazens } = useFetch<Armazem>("/api/estoque/armazens");
  const { data: produtos, loading: produtosLoading } = useFetch<Produto>(
    armazemId ? `/api/produtos?armazemId=${armazemId}` : ""
  );

  const filteredProdutos = produtos.filter(
    (produto) =>
      produto.sku.toLowerCase().includes(sku.toLowerCase()) ||
      produto.nome.toLowerCase().includes(sku.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProduto = (produto: Produto) => {
    setSku(produto.sku);
    setIsDropdownOpen(false);
  };

  const handleAddProduto = async () => {
    if (!sku || !quantidade || Number(quantidade) <= 0) {
      setMessage("Insira um SKU válido e uma quantidade maior que zero.");
      setMessageType("error");
      return;
    }

    const qty = Number(quantidade);
    const produtoToAdd = produtos.find((p) => p.sku === sku);

    try {
      if (produtoToAdd) {
        setSaidaProdutos((prev) => {
          const existing = prev.find(
            (p) => p.produtoId === produtoToAdd.id && !p.isKit
          );
          if (existing) {
            existing.quantidade += qty; // Soma a nova quantidade
            return [...prev];
          }
          return [
            ...prev,
            {
              produtoId: produtoToAdd.id,
              quantidade: qty,
              sku: produtoToAdd.sku,
              isKit: false,
            },
          ];
        });
      } else {
        const kitResponse = await fetch(`/api/kits?sku=${sku}`);
        const kitData = await kitResponse.json();

        if (kitData && kitData.length > 0) {
          const kit = kitData[0];
          setSaidaProdutos((prev) => {
            const existing = prev.find(
              (p) => p.produtoId === kit.id && p.isKit
            );
            if (existing) {
              existing.quantidade += qty;
              existing.componentes = kit.componentes.map((c: any) => ({
                ...c,
                quantidade: c.quantidade * (existing.quantidade + qty),
              }));
              return [...prev];
            }
            return [
              ...prev,
              {
                produtoId: kit.id,
                quantidade: qty,
                sku: kit.sku,
                isKit: true,
                componentes: kit.componentes.map((c: any) => ({
                  produtoId: c.produto.id,
                  quantidade: c.quantidade * qty,
                  sku: c.produto.sku,
                })),
              },
            ];
          });
        } else {
          setMessage("Produto ou kit não encontrado.");
          setMessageType("error");
          return;
        }
      }

      setSku("");
      setQuantidade("");
      setMessage("");
      setIsDropdownOpen(false);
    } catch (error) {
      setMessage("Erro ao adicionar item.");
      setMessageType("error");
    }
  };

  const handleRemoveProduto = (sku: string) => {
    setSaidaProdutos((prev) => prev.filter((p) => p.sku !== sku));
  };

  const handleRegistrarSaida = async () => {
    if (saidaProdutos.length === 0 || !armazemId) {
      setMessage("Adicione itens e selecione um armazém.");
      setMessageType("error");
      return;
    }

    try {
      const response = await fetch("/api/saida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtos: saidaProdutos, armazemId }),
      });

      if (response.ok) {
        setMessage("Saída registrada com sucesso!");
        setMessageType("success");
        setSaidaProdutos([]);
        onSave();
        setTimeout(onClose, 1500);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || "Erro ao registrar saída.");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Erro ao registrar saída.");
      setMessageType("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 w-full max-w-md max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 tracking-tight">
          Registrar Nova Saída
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Armazém
            </label>
            <div className="relative">
              <select
                value={armazemId || ""}
                onChange={(e) => setArmazemId(e.target.value || null)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                <option value="">Selecione um armazém</option>
                {armazens.map((armazem) => (
                  <option key={armazem.id} value={armazem.id}>
                    {armazem.nome}
                  </option>
                ))}
              </select>
              <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            </div>
          </div>
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Produto ou Kit (SKU ou Nome)
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Digite o SKU ou nome"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {isDropdownOpen && armazemId && (
              <ul className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {produtosLoading ? (
                  <li className="p-3 text-gray-500 dark:text-gray-400 text-sm">
                    Carregando...
                  </li>
                ) : filteredProdutos.length > 0 ? (
                  filteredProdutos.map((produto) => (
                    <li
                      key={produto.id}
                      onClick={() => handleSelectProduto(produto)}
                      className="p-3 hover:bg-indigo-50 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-200 text-sm transition-colors duration-150"
                    >
                      <span className="font-medium">{produto.sku}</span> -{" "}
                      {produto.nome}
                    </li>
                  ))
                ) : (
                  <li className="p-3 text-gray-500 dark:text-gray-400 text-sm">
                    Nenhum produto encontrado
                  </li>
                )}
              </ul>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quantidade
            </label>
            <input
              type="number"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              min="1"
              placeholder="Digite a quantidade"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleAddProduto}
            className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-md"
          >
            <FaPlus className="mr-2" /> Adicionar Item
          </button>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Itens na Saída
            </h3>
            {saidaProdutos.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nenhum item adicionado ainda.
              </p>
            ) : (
              <ul className="space-y-3 max-h-48 overflow-y-auto border-t border-gray-200 dark:border-gray-700 pt-3">
                {saidaProdutos.map((item) => (
                  <li
                    key={item.sku}
                    className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-200">
                        {item.sku}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        Qtd: {item.quantidade}
                      </span>
                      {item.isKit && (
                        <span className="text-xs bg-indigo-500 text-white px-2 py-1 rounded-full">
                          Kit
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveProduto(item.sku)}
                      className="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-700 transition-colors duration-150"
                    >
                      <FaTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleRegistrarSaida}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 shadow-md"
            >
              Registrar Saída
            </button>
          </div>
          {message && (
            <p
              className={`mt-4 text-center text-sm font-medium px-3 py-2 rounded-lg ${
                messageType === "success"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovaSaidaModal;
