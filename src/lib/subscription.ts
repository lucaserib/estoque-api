import { prisma } from "@/lib/prisma";
import { trialEndsAt } from "@/lib/billing";
import type { Subscription } from "@prisma/client";

export async function getOrCreateSubscription(
  userId: string
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return prisma.subscription.create({
    data: {
      userId,
      status: "TRIALING",
      trialEndsAt: trialEndsAt(),
    },
  });
}

export function isSubscriptionActive(subscription: Subscription): boolean {
  if (subscription.status === "ACTIVE") return true;
  if (subscription.status === "TRIALING") {
    return subscription.trialEndsAt.getTime() > Date.now();
  }
  return false;
}
