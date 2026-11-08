import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { TemaPreferencia } from "@prisma/client";

const TEMAS_VALIDOS = Object.values(TemaPreferencia);

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const config = await prisma.configuracaoGeral.findUnique({
      where: { userId: user.contaId },
    });

    return NextResponse.json({
      aliquotaImposto: config?.aliquotaImposto ?? 0,
      nomeLoja: config?.nomeLoja ?? null,
      logoUrl: config?.logoUrl ?? null,
      tema: config?.tema ?? "SISTEMA",
      avgDeliveryDaysPadrao: config?.avgDeliveryDaysPadrao ?? 7,
    });
  } catch (error) {
    console.error("Erro ao buscar configurações gerais:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { aliquotaImposto, nomeLoja, logoUrl, tema, avgDeliveryDaysPadrao } = body;

    const dadosParaUpdate: {
      aliquotaImposto?: number;
      nomeLoja?: string | null;
      logoUrl?: string | null;
      tema?: TemaPreferencia;
      avgDeliveryDaysPadrao?: number;
    } = {};

    if (aliquotaImposto !== undefined) {
      exigirPermissao(user.role, "VER_CUSTO");

      if (
        typeof aliquotaImposto !== "number" ||
        Number.isNaN(aliquotaImposto) ||
        aliquotaImposto < 0 ||
        aliquotaImposto > 1
      ) {
        return NextResponse.json(
          { error: "aliquotaImposto deve ser um número entre 0 e 1" },
          { status: 400 }
        );
      }
      dadosParaUpdate.aliquotaImposto = aliquotaImposto;
    }

    if (nomeLoja !== undefined) {
      if (nomeLoja !== null && (typeof nomeLoja !== "string" || nomeLoja.length > 80)) {
        return NextResponse.json(
          { error: "nomeLoja deve ser um texto de até 80 caracteres" },
          { status: 400 }
        );
      }
      dadosParaUpdate.nomeLoja = nomeLoja === null ? null : nomeLoja.trim() || null;
    }

    if (logoUrl !== undefined) {
      if (logoUrl !== null && typeof logoUrl !== "string") {
        return NextResponse.json({ error: "logoUrl inválido" }, { status: 400 });
      }
      dadosParaUpdate.logoUrl = logoUrl;
    }

    if (tema !== undefined) {
      if (!TEMAS_VALIDOS.includes(tema)) {
        return NextResponse.json(
          { error: `tema deve ser um de: ${TEMAS_VALIDOS.join(", ")}` },
          { status: 400 }
        );
      }
      dadosParaUpdate.tema = tema;
    }

    if (avgDeliveryDaysPadrao !== undefined) {
      if (
        typeof avgDeliveryDaysPadrao !== "number" ||
        !Number.isInteger(avgDeliveryDaysPadrao) ||
        avgDeliveryDaysPadrao < 1 ||
        avgDeliveryDaysPadrao > 365
      ) {
        return NextResponse.json(
          { error: "avgDeliveryDaysPadrao deve ser um número inteiro entre 1 e 365" },
          { status: 400 }
        );
      }
      dadosParaUpdate.avgDeliveryDaysPadrao = avgDeliveryDaysPadrao;
    }

    const config = await prisma.configuracaoGeral.upsert({
      where: { userId: user.contaId },
      update: dadosParaUpdate,
      create: { userId: user.contaId, ...dadosParaUpdate },
    });

    return NextResponse.json({
      aliquotaImposto: config.aliquotaImposto,
      nomeLoja: config.nomeLoja,
      logoUrl: config.logoUrl,
      tema: config.tema,
      avgDeliveryDaysPadrao: config.avgDeliveryDaysPadrao,
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao atualizar configurações gerais:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
