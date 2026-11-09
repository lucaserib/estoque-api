"use client";

import { SessionProvider } from "next-auth/react";
import { LayoutProvider } from "./context/LayoutContext";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { InterceptadorAssinatura } from "./InterceptadorAssinatura";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
      >
        <LayoutProvider>
          <InterceptadorAssinatura />
          {children}
          <Toaster />
        </LayoutProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
