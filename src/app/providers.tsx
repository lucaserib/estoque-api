"use client";

import { SessionProvider } from "next-auth/react";
import { LayoutProvider } from "./context/LayoutContext";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class">
        <LayoutProvider>
          {children}
          <Toaster />
        </LayoutProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
