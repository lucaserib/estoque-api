import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ehAdminPlataforma } from "@/lib/adminPlataforma";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Skubo Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (!ehAdminPlataforma(session.user.email)) notFound();

  return <AdminShell email={session.user.email ?? ""}>{children}</AdminShell>;
}
