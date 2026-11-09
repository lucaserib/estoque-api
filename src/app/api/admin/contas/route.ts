import { NextRequest, NextResponse } from "next/server";
import { respostaErroAdmin, verifyAdminPlataforma } from "@/helpers/verifyAdminPlataforma";
import { listarContas, type FiltrosContas } from "@/modules/admin/contas";

function booleano(valor: string | null): boolean | null {
  if (valor === "sim") return true;
  if (valor === "nao") return false;
  return null;
}

function data(valor: string | null): Date | null {
  if (!valor) return null;
  const lida = new Date(valor);
  return Number.isNaN(lida.getTime()) ? null : lida;
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminPlataforma(request);
    const p = request.nextUrl.searchParams;
    const filtros: FiltrosContas = {
      busca: p.get("busca"),
      situacao: (p.get("situacao") as FiltrosContas["situacao"]) || null,
      plano: (p.get("plano") as FiltrosContas["plano"]) || null,
      origem: p.get("origem"),
      ml: booleano(p.get("ml")),
      bling: booleano(p.get("bling")),
      saldoIa: (p.get("saldoIa") as FiltrosContas["saldoIa"]) || null,
      de: data(p.get("de")),
      ate: data(p.get("ate")),
      testeInterno: booleano(p.get("testeInterno")),
    };
    return NextResponse.json({ contas: await listarContas(filtros) });
  } catch (error) {
    return respostaErroAdmin(error, "Erro ao listar contas");
  }
}
