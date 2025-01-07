import { Sidebar } from "../components/Sidebar";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex h-screen">
      <div className="w-64">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
};

export default Layout;
