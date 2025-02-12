import CardValorEstoque from "@/app/components/dashboard/CardValorEstoque";
import FluxoFinanceiroChart from "@/app/components/dashboard/FluxoFinanceiroChart";
import TopProdutosChart from "@/app/components/dashboard/TopProdutosChart";
import Header from "@/app/components/Header";

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto p-6 ">
      <div className="mb-5">
        <Header name="Dashboard" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopProdutosChart />
        <FluxoFinanceiroChart />
        <CardValorEstoque />
      </div>
    </div>
  );
};

export default Dashboard;
