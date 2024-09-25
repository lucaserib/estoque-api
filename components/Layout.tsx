import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-grow p-6 bg-gray-100 dark:bg-gray-800 ml-64">
        {children}
      </div>
    </div>
  );
};

export default Layout;
