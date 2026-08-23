import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateSubscription, isSubscriptionActive } from "@/lib/subscription";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import DashboardWrapper from "../DashboardWrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isMercadoPagoConfigured()) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (userId) {
      const subscription = await getOrCreateSubscription(userId);
      if (!isSubscriptionActive(subscription)) {
        redirect("/assinatura");
      }
    }
  }

  return <DashboardWrapper>{children}</DashboardWrapper>;
}
