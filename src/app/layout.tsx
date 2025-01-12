import { ReactNode } from "react";
import "../../styles/global.css";
import Sidebar from "../components/layout/Sidebar";
import { auth } from "@/lib/auth";

interface RootLayoutProps {
  children: ReactNode;
}

const RootLayout = async ({ children }: RootLayoutProps) => {
  const session = await auth();

  return (
    <html lang="pt-BR">
      <body className="h-screen overflow-hidden">
        <div className="flex h-full bg-white">
          {/* Sidebar exibida apenas para usuários autenticados */}
          {session && (
            <div className="w-64 h-full overflow-y-auto">
              <Sidebar />
            </div>
          )}
          <main
            className={`flex-1 h-full overflow-y-auto p-4 ${
              session ? "" : "w-full"
            }`}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
