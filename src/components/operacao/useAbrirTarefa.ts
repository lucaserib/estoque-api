"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useAbrirTarefa() {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  const abrir = useCallback(
    (id: string | null) => {
      const novos = new URLSearchParams(parametros.toString());
      if (id) novos.set("tarefa", id);
      else novos.delete("tarefa");
      const consulta = novos.toString();
      router.replace(`${pathname}${consulta ? `?${consulta}` : ""}`, { scroll: false });
    },
    [router, pathname, parametros]
  );

  return { abrir, tarefaAberta: parametros.get("tarefa") };
}
