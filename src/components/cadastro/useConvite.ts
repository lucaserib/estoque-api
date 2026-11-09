"use client";

import { useEffect, useState } from "react";

export interface ConviteCliente {
  valido: boolean;
  convidadoPor: string | null;
  bonusPerguntasIa: number;
  diasTesteExtra: number;
}

export type EstadoConvite = { estado: "vazio" } | { estado: "verificando" } | { estado: "invalido" } | ({ estado: "valido" } & ConviteCliente);

export function useConvite(codigo: string): EstadoConvite {
  const [resultado, setResultado] = useState<EstadoConvite>({ estado: "vazio" });
  const limpo = codigo.trim().toUpperCase();

  useEffect(() => {
    if (limpo.length < 5) {
      setResultado({ estado: "vazio" });
      return;
    }
    let cancelado = false;
    setResultado({ estado: "verificando" });
    const espera = setTimeout(() => {
      fetch(`/api/indicacao/convite?codigo=${encodeURIComponent(limpo)}`)
        .then((resposta) => (resposta.ok ? resposta.json() : null))
        .then((dados: ConviteCliente | null) => {
          if (cancelado) return;
          setResultado(dados?.valido ? { estado: "valido", ...dados } : { estado: "invalido" });
        })
        .catch(() => {
          if (!cancelado) setResultado({ estado: "vazio" });
        });
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [limpo]);

  return resultado;
}

export function textoDoBonus(convite: ConviteCliente): string {
  const partes: string[] = [];
  if (convite.bonusPerguntasIa > 0) partes.push(`${convite.bonusPerguntasIa} perguntas extras para a IA`);
  if (convite.diasTesteExtra > 0) partes.push(`${convite.diasTesteExtra} dias a mais de teste`);
  return partes.join(" e ");
}
