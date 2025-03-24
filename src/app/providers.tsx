"use client";

import { SessionProvider } from "next-auth/react";
import { LayoutProvider } from "./context/LayoutContext";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LayoutProvider>
        {children}
        <Toaster/>
      </LayoutProvider>
    </SessionProvider>
  );
}
