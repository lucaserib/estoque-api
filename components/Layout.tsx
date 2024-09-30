import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-grow p-6 bg-gray-100 dark:bg-gray-800 md:ml-64">
        {children}
      </div>
    </div>
  );
};

export default Layout;
