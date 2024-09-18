// components/Layout.tsx
import { Sidebar } from "./Sidebar"; // Importar a Sidebar

import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar à esquerda */}
      <Sidebar />

      {/* Conteúdo principal */}
      <main className="flex-grow p-6 bg-gray-100">
        {children} {/* Renderiza o conteúdo da página aqui */}
      </main>
    </div>
  );
};

export default Layout;
