// components/Layout.tsx
import { Sidebar } from "./Sidebar";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth } from "../lib/firebase";
import { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const isAuthPage =
    router.pathname === "/auth/login" || router.pathname === "/auth/register";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (isAuthPage) {
          router.push("/");
        }
      } else if (!isAuthPage) {
        router.push("/auth/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, isAuthPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800">
        <div className="text-xl font-semibold">Carregando...</div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen ${
        user ? "bg-gray-100 dark:bg-gray-800" : "bg-white"
      }`}
    >
      {user && !isAuthPage && <Sidebar />}
      <main
        className={`flex-grow ${user && !isAuthPage ? "md:ml-64 p-6" : ""}`}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
