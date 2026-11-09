import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerPreferencias } from "@/modules/clientes/consentimento";
import { Logo } from "@/components/brand/Logo";
import { FormularioBoasVindas } from "./FormularioBoasVindas";

export default async function BoasVindasPage() {
  const sessao = await getServerSession(authOptions);
  if (!sessao?.user?.id) redirect("/login");

  const usuario = await prisma.user.findUnique({
    where: { id: sessao.user.id },
    select: { name: true, contaId: true, preferencias: true },
  });
  if (!usuario) redirect("/login");
  const dono = !usuario.contaId;
  if (lerPreferencias(usuario.preferencias).termosVersao) redirect(dono ? "/comecar" : "/");

  const perfil = dono
    ? await prisma.perfilCliente.findUnique({
        where: { contaId: sessao.user.id },
        select: { nomeLoja: true, whatsapp: true, faixaPedidosMes: true, canais: true, comoConheceu: true },
      })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8 sm:py-12">
        <Logo size="sm" />
        <div className="rounded-card border border-border bg-card p-6 shadow-lift sm:p-8">
          <FormularioBoasVindas nome={usuario.name} dono={dono} perfilInicial={perfil} />
        </div>
      </div>
    </div>
  );
}
