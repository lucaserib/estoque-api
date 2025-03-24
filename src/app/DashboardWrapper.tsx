"use client";

import React, { useEffect } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/layout/Sidebar";
import { useLayout } from "./context/LayoutContext";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isSidebarCollapsed, isDarkMode } = useLayout();

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", isDarkMode);
    html.classList.toggle("light", !isDarkMode);
  }, [isDarkMode]);

  return (
    <div
      className={`${
        isDarkMode ? "dark" : "light"
      } flex bg-gray-50 text-gray-900 w-full min-h-screen`}
    >
      <Sidebar />

      <main
        className={`flex flex-col w-full h-full py-7 px-9 bg-gray-50 ${
          isSidebarCollapsed ? "md:pl-24" : "md:pl-72"
        }`}
      >
        <Navbar />
        {children}
      </main>
    </div>
  );
};

const DashboardWrapper = ({ children }: { children: React.ReactNode }) => {
  return <DashboardLayout>{children}</DashboardLayout>;
};

export default DashboardWrapper;
