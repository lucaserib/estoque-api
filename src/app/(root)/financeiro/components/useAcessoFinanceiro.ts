"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { podeVer } from "@/lib/permissoes";

export function useAcessoFinanceiro() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const papel = session?.user?.role;
  const podeVerFinanceiro = papel ? podeVer(papel, "FINANCEIRO_VER") : false;

  useEffect(() => {
    if (status === "authenticated" && !podeVerFinanceiro) {
      router.replace("/");
    }
  }, [status, podeVerFinanceiro, router]);

  return {
    carregando: status === "loading",
    podeVerFinanceiro,
    papel,
  };
}
