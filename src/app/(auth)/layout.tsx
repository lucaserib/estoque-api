"use client";
import { useEffect } from "react";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    document.documentElement.classList.add("dark"); // Força o dark mode
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
};

export default AuthLayout;
