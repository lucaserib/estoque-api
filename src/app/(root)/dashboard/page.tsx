import TopProdutosChart from "@/app/components/dashboard/TopProdutosChart";

const Dashboard = () => {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard de Estoque</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopProdutosChart />
      </div>
    </div>
  );
};

export default Dashboard;
