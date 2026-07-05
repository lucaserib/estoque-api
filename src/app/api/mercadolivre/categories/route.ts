// src/app/api/mercadolivre/categories/route.ts

import { NextRequest, NextResponse } from "next/server";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId") || "MLB";
    const categoryId = searchParams.get("categoryId");

    if (categoryId) {
      // Buscar categoria específica
      const category = await MercadoLivreService.getCategory(categoryId);
      return NextResponse.json(category);
    } else {
      // Buscar todas as categorias do site
      const categories = await MercadoLivreService.getCategories(siteId);
      return NextResponse.json(categories);
    }
  } catch (error) {
    console.error("Erro ao buscar categorias ML:", error);
    return NextResponse.json(
      { error: "Erro ao buscar categorias" },
      { status: 500 }
    );
  }
}
