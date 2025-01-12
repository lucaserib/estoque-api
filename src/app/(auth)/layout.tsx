import { ReactNode } from "react";
import "../../../styles/global.css";

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 overflow-hidden">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
};

export default AuthLayout;
