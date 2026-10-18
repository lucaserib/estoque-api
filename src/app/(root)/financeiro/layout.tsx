import type { ReactNode } from "react";
import { SincronizacaoFinanceiraProvider } from "./components/SincronizacaoFinanceira";

export default function FinanceiroLayout({ children }: { children: ReactNode }) {
  return <SincronizacaoFinanceiraProvider>{children}</SincronizacaoFinanceiraProvider>;
}
