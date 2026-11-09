import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { NotificationService } from "@/services/notificationService";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { serializeWithEAN } from "@/utils/api";
import { emParalelo } from "@/modules/financeiro/ingestao/paralelo";
import {
  atualizarEstoqueFullDosAnuncios,
  listarIdsAnunciosMl,
  registrarErroAnuncio,
  sincronizarAnuncioMl,
} from "@/modules/catalogo/anunciosMl";
import { iniciarSincronizacaoCatalogo } from "@/modules/catalogo/sincronizacao";
import { permissaoErrorResponse } from "@/lib/permissoes";

export const maxDuration = 60;

const CONCORRENCIA = 4;
const TEMPO_MAXIMO_MS = 45000;

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const action = searchParams.get("action");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.contaId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    if (action === "history") {
      const history = await prisma.mercadoLivreSyncHistory.findMany({
        where: { mercadoLivreAccountId: accountId },
        orderBy: { startedAt: "desc" },
        take: 50,
      });
      return NextResponse.json(history);
    }

    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: { mercadoLivreAccountId: accountId },
      include: { produto: true },
      orderBy: { lastSyncAt: "desc" },
    });
    return NextResponse.json(serializeWithEAN(produtos));
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("[SYNC][GET] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dados de sincronização" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let notifyUserId: string | null = null;
  try {
    const user = await verifyUserAtivo(request);
    notifyUserId = user.id;

    const rateLimit = await checkRateLimit("ml-sync", user.id, 5, 300);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.contaId,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const startTime = Date.now();
    const accessToken = await MercadoLivreService.getValidToken(accountId);
    const ids = await listarIdsAnunciosMl(accessToken, account.mlUserId);
    const conta = { id: account.id, userId: account.userId, siteId: account.siteId, mlUserId: account.mlUserId };

    let newItems = 0;
    let updatedItems = 0;
    let errorItems = 0;
    let pendentes = 0;
    const prazo = startTime + TEMPO_MAXIMO_MS;

    for (let i = 0; i < ids.length; i += CONCORRENCIA * 2) {
      if (Date.now() > prazo) {
        pendentes = ids.length - i;
        break;
      }
      await emParalelo(ids.slice(i, i + CONCORRENCIA * 2), CONCORRENCIA, async (itemId) => {
        try {
          const resultado = await sincronizarAnuncioMl(conta, accessToken, itemId);
          if (resultado === "CRIADO") newItems++;
          else updatedItems++;
        } catch (erro) {
          errorItems++;
          await registrarErroAnuncio(account.id, itemId, erro instanceof Error ? erro.message : "Erro desconhecido");
        }
      });
    }

    await atualizarEstoqueFullDosAnuncios(account.userId, account.id);
    if (pendentes > 0) await iniciarSincronizacaoCatalogo(user.contaId);

    return NextResponse.json({
      success: true,
      syncedCount: newItems + updatedItems,
      newItems,
      updatedItems,
      errorItems,
      pendentes,
      totalItems: ids.length,
      duration: Math.round((Date.now() - startTime) / 1000),
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro na sincronização:", error);
    if (notifyUserId) {
      await NotificationService.notifySyncError(
        notifyUserId,
        error instanceof Error ? error.message : "Erro na sincronização"
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro na sincronização",
      },
      { status: 500 }
    );
  }
}
