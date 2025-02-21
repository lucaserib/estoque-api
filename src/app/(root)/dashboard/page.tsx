"use client";

import CardValorEstoque from "@/app/components/dashboard/CardValorEstoque";
import EntradasChart from "@/app/components/dashboard/EntradasChart";
import EstoqueSegurancaCard from "@/app/components/dashboard/EstoqueSegurancaCard";
import FluxoFinanceiroChart from "@/app/components/dashboard/FluxoFinanceiroChart";
import TopProdutosChart from "@/app/components/dashboard/TopProdutosChart";
import Header from "@/app/components/Header";

const Dashboard = () => {
  return (
    <div className="max-w-[1400px] mx-auto p-6">
      <div className="mb-5">
        <Header name="Dashboard" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
        <TopProdutosChart />

        <div className="md:col-span-2">
          <FluxoFinanceiroChart />
        </div>

        <CardValorEstoque />

        <div className="md:col-span-2">
          <EntradasChart />
        </div>

        <EstoqueSegurancaCard />
      </div>
    </div>
  );
};

export default Dashboard;
