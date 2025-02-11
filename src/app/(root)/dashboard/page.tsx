"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/app/components/ui/input";

const Dashboard = () => {
  // const [dateRange, setDateRange] = useState(""); // Filtro de data
  // const [selectedProduct, setSelectedProduct] = useState(""); // Filtro de produto
  // return (
  //   <div className="max-w-7xl mx-auto p-6">
  //     <h1 className="text-3xl font-bold mb-6">Dashboard de Estoque</h1>
  //     {/* Filtros */}
  //     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
  //       {/* Filtro por Data */}
  //       <Input
  //         type="date"
  //         value={dateRange}
  //         onChange={(e) => setDateRange(e.target.value)}
  //         className="w-full"
  //       />
  //       {/* Filtro por Produto */}
  //       <Select onValueChange={setSelectedProduct}>
  //         <SelectTrigger className="w-full">
  //           <SelectValue placeholder="Filtrar por Produto" />
  //         </SelectTrigger>
  //         <SelectContent>
  //           <SelectItem value="">Todos os Produtos</SelectItem>
  //           <SelectItem value="produto1">Produto 1</SelectItem>
  //           <SelectItem value="produto2">Produto 2</SelectItem>
  //         </SelectContent>
  //       </Select>
  //     </div>
  //     {/* Grid dos Gráficos */}
  //     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  //       {/* Gráfico 1: Top 3 Produtos mais Vendidos */}
  //       <Card>
  //         <CardHeader>
  //           <CardTitle>Top 3 Produtos Mais Vendidos</CardTitle>
  //         </CardHeader>
  //         <CardContent>
  //           {/* Aqui entra o gráfico */}
  //           <p>Gráfico de Top 3 Produtos</p>
  //         </CardContent>
  //       </Card>
  //       {/* Gráfico 2: Fluxo de Valores do Estoque */}
  //       <Card>
  //         <CardHeader>
  //           <CardTitle>Fluxo Financeiro do Estoque</CardTitle>
  //         </CardHeader>
  //         <CardContent>
  //           {/* Aqui entra o gráfico */}
  //           <p>Gráfico de Entradas e Saídas</p>
  //         </CardContent>
  //       </Card>
  //       {/* Gráfico 3: Últimas Saídas */}
  //       <Card>
  //         <CardHeader>
  //           <CardTitle>Últimas Saídas</CardTitle>
  //         </CardHeader>
  //         <CardContent>
  //           {/* Aqui entra o gráfico */}
  //           <p>Gráfico de Últimas Saídas</p>
  //         </CardContent>
  //       </Card>
  //       {/* Gráfico 4: Valor Total do Estoque */}
  //       <Card>
  //         <CardHeader>
  //           <CardTitle>Valor Total em Estoque</CardTitle>
  //         </CardHeader>
  //         <CardContent>
  //           {/* Aqui entra o gráfico */}
  //           <p>Gráfico de Valor Total</p>
  //         </CardContent>
  //       </Card>
  //     </div>
  //   </div>
  // );
};

export default Dashboard;
