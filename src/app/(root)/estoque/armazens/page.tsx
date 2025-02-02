"use client";

import LoadingSpinner from "@/app/components/LoadingSpinner";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";

interface Produto {
  id: number;
  nome: string;
  sku: string;
  custoMedio: number;
}

interface Estoque {
  id: number;
  produtoId: number;
  produto: Produto;
  quantidade: number;
  estoqueSeguranca: number;
}

interface Armazem {
  id: number;
  nome: string;
}

const Armazens = () => {
  const [armazens, setArmazens] = useState<Armazem[]>([]);
  const [estoque, setEstoque] = useState<Estoque[]>([]);
  const [selectedArmazemId, setSelectedArmazemId] = useState<string | null>(
    null
  );
  const [novoArmazem, setNovoArmazem] = useState("");
  const [estoqueSeguranca, setEstoqueSeguranca] = useState<number | null>(null);
  const [quantidadeProduto, setQuantidadeProduto] = useState<number | null>(
    null
  );
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Estoque | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchArmazens();
  }, []);

  useEffect(() => {
    if (selectedArmazemId) fetchEstoque(Number(selectedArmazemId));
  }, [selectedArmazemId]);

  const fetchArmazens = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/estoque/armazens");
      const data = await response.json();
      setArmazens(data);
    } catch (error) {
      console.error("Erro ao buscar armazéns:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEstoque = async (armazemId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/estoque/${armazemId}`);
      const data = await response.json();
      setEstoque(data);
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCriarArmazem = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/estoque/criarArmazem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoArmazem }),
      });
      setNovoArmazem("");
      fetchArmazens();
    } catch (error) {
      console.error("Erro ao criar armazém:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAtualizarEstoque = async (produtoId: number) => {
    if (!selectedArmazemId) return;

    try {
      setIsSaving(true);

      if (quantidadeProduto !== null) {
        await fetch("/api/estoque/armazens", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId,
            armazemId: Number(selectedArmazemId),
            quantidade: quantidadeProduto,
          }),
        });
      }

      if (estoqueSeguranca !== null) {
        await fetch(`/api/estoque/estoqueSeguranca`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            produtoId,
            armazemId: Number(selectedArmazemId),
            estoqueSeguranca,
          }),
        });
      }

      setEstoque((prev) =>
        prev.map((item) =>
          item.produto.id === produtoId
            ? {
                ...item,
                quantidade: quantidadeProduto ?? item.quantidade,
                estoqueSeguranca: estoqueSeguranca ?? item.estoqueSeguranca,
              }
            : item
        )
      );

      setProdutoEmEdicao(null);
      setQuantidadeProduto(null);
      setEstoqueSeguranca(null);
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (error) {
      console.error("Erro ao atualizar estoque:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditarProduto = (produto: Estoque) => {
    setProdutoEmEdicao(produto);
    setQuantidadeProduto(produto.quantidade);
    setEstoqueSeguranca(produto.estoqueSeguranca);
    setIsModalOpen(true);
  };

  const produtosFiltrados = estoque.filter(
    (item) =>
      item.produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="transition-all">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Gerenciar estoque
        </h1>

        {/* Seletor de Armazem */}
        <div className="flex justify-between items-center mb-6">
          <Select onValueChange={(value) => setSelectedArmazemId(value)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecionar Armazém" />
            </SelectTrigger>
            <SelectContent>
              {armazens.map((armazem) => (
                <SelectItem key={armazem.id} value={String(armazem.id)}>
                  {armazem.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="default"
                className="bg-blue-300 shadow-md hover:bg-blue-200 ml-1"
              >
                Criar Armazém
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-100 border rounded-md shadow-md">
              <DialogHeader>
                <DialogTitle>Novo Armazém</DialogTitle>
              </DialogHeader>
              <Input
                type="text"
                placeholder="Nome do Armazém"
                value={novoArmazem}
                onChange={(e) => setNovoArmazem(e.target.value)}
              />
              <Button
                onClick={handleCriarArmazem}
                className="mt-4 w-full bg-blue-300 hover:bg-blue-200 shadow-sm"
              >
                Criar
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <Input
        type="text"
        placeholder="Buscar por nome ou SKU..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-64 mb-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm"
      />

      {/* Tabela de Produtos */}
      {selectedArmazemId && (
        <div className="rounded-md shadow-md">
          <Card>
            <div className="rounded-md">
              <CardHeader>
                <CardTitle className="text-gray-900 font-semibold">
                  Estoque de Produtos
                </CardTitle>
              </CardHeader>
            </div>
            <CardContent className="flex justify-center items-center min-h-[200px]">
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                <Table>
                  <TableHeader className="bg-gray-400">
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Estoque Segurança</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="hover:bg-gray-200">
                    {produtosFiltrados.map((item) => (
                      <TableRow
                        key={item.id}
                        className={
                          item.quantidade <= item.estoqueSeguranca
                            ? "bg-red-200"
                            : ""
                        }
                      >
                        <TableCell>{item.produto.nome}</TableCell>
                        <TableCell>{item.quantidade}</TableCell>
                        <TableCell>{item.estoqueSeguranca}</TableCell>
                        <TableCell className="flex">
                          <Dialog
                            open={isModalOpen}
                            onOpenChange={setIsModalOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                onClick={() => handleEditarProduto(item)}
                              >
                                <FaEdit className="text-blue-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-100 border rounded-md shadow-md">
                              <DialogHeader>
                                <DialogTitle>Editar Produto</DialogTitle>
                              </DialogHeader>
                              Editar quantidade:
                              <Input
                                type="number"
                                value={quantidadeProduto ?? ""}
                                onChange={(e) =>
                                  setQuantidadeProduto(
                                    Number(e.target.value) || 0
                                  )
                                }
                              />
                              Editar Estoque de segurança:
                              <Input
                                type="number"
                                placeholder="Editar estoque de segurança"
                                value={estoqueSeguranca ?? ""}
                                onChange={(e) =>
                                  setEstoqueSeguranca(
                                    Number(e.target.value) || 0
                                  )
                                }
                              />
                              <Button
                                onClick={() => {
                                  handleAtualizarEstoque(item.produto.id);
                                  setIsModalOpen(false); // Fecha o modal após salvar
                                }}
                                className="mt-4 w-full bg-blue-300 hover:bg-blue-200 shadow-sm"
                              >
                                Salvar
                              </Button>
                              {isSaving && <LoadingSpinner />}
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" className="pl-0.5">
                            <FaTrash className="text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Armazens;
