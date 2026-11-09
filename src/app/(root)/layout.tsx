import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { obterSituacaoConta } from "@/modules/conta/situacao";
import { prisma } from "@/lib/prisma";
import { lerPreferencias } from "@/modules/clientes/consentimento";
import DashboardWrapper from "../DashboardWrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const contaId = session?.user?.contaId ?? session?.user?.id;

  if (!session?.user?.id || !contaId) redirect("/login");

  const [situacao, usuario] = await Promise.all([
    obterSituacaoConta(contaId),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { preferencias: true } }),
  ]);
  if (!lerPreferencias(usuario?.preferencias).termosVersao) redirect("/boas-vindas");
  if (!situacao.podeUsar) redirect("/assinatura");

  return <DashboardWrapper>{children}</DashboardWrapper>;
}
