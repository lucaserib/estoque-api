import { ReactNode } from "react";
import "./globals.css";
import Sidebar from "./components/layout/Sidebar";

export const metadata = {
  title: "Meu Sistema de Estoque",
  description: "Gerencie seu estoque de forma eficiente.",
};

interface LayoutProps {
  children: ReactNode;
}

const RootLayout = ({ children }: LayoutProps) => {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex h-screen">
          <div className="w-64">
            <Sidebar />
          </div>
          <main className="flex-1 overflow-auto p-4">{children}</main>
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
