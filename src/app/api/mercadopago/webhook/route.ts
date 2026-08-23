import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { MercadoPagoService } from "@/services/mercadoPagoService";
import { PRICING } from "@/lib/billing";

function isValidSignature(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;

  const signatureHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!signatureHeader || !requestId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    })
  );

  const ts = parts.ts;
  const receivedHash = parts.v1;
  if (!ts || !receivedHash) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedHash),
    Buffer.from(receivedHash)
  );
}

async function handlePreapprovalNotification(preapprovalId: string) {
  const preapproval = await MercadoPagoService.getPreapproval(preapprovalId);

  const subscription = await prisma.subscription.findUnique({
    where: { mpPreapprovalId: preapprovalId },
  });
  if (!subscription) return;

  if (preapproval.status === "authorized") {
    const now = new Date();
    const currentPeriodEnd = new Date(now);
    if (subscription.plan === "ANNUAL") {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd,
      },
    });
  } else if (preapproval.status === "cancelled") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELED" },
    });
  }
}

async function handlePaymentNotification(paymentId: string) {
  const payment = await MercadoPagoService.getPayment(paymentId);
  if (!payment.external_reference) return;

  const subscription = await prisma.subscription.findUnique({
    where: { userId: payment.external_reference },
  });
  if (!subscription || !subscription.mpPreapprovalId) return;

  if (payment.status === "rejected" || payment.status === "cancelled") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "PAST_DUE" },
    });
    return;
  }

  if (payment.status !== "approved") return;

  const billingCyclesCompleted = subscription.billingCyclesCompleted + 1;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "ACTIVE", billingCyclesCompleted },
  });

  if (subscription.plan === "MONTHLY" && billingCyclesCompleted === 1) {
    await MercadoPagoService.updatePreapprovalAmount(
      subscription.mpPreapprovalId,
      PRICING.MONTHLY_RENEWAL
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { searchParams } = new URL(request.url);
  const type = body?.type || searchParams.get("type");
  const dataId = body?.data?.id || searchParams.get("data.id");

  if (!type || !dataId) {
    return NextResponse.json({ received: true });
  }

  if (!isValidSignature(request, String(dataId))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  try {
    if (type === "subscription_preapproval" || type === "preapproval") {
      await handlePreapprovalNotification(String(dataId));
    } else if (type === "payment") {
      await handlePaymentNotification(String(dataId));
    }
  } catch (error) {
    console.error("Erro ao processar webhook do Mercado Pago:", error);
    return NextResponse.json(
      { error: "Erro ao processar notificação" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
