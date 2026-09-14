"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Thumb } from "@/components/ui/thumb";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { UsuarioConviteDialog } from "@/components/UsuarioConviteDialog";

interface Usuario {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
}

interface Convite {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  COMPRAS: "Compras",
  ESTOQUE: "Estoque",
  VENDAS: "Vendas",
  LEITURA: "Somente leitura",
};

const ROLE_ESCOPO: Record<string, string> = {
  ADMIN: "Acesso total",
  COMPRAS: "Reposição, pedidos, fornecedores",
  ESTOQUE: "Produtos, saídas, armazéns",
  VENDAS: "Mercado Livre, saídas",
  LEITURA: "Somente leitura",
};

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function UsuariosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  const loadUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/usuarios");
      if (!response.ok) throw new Error("Erro ao carregar usuários");
      const data = await response.json();
      setUsuarios(data.users || []);
      setConvites(data.invitations || []);
    } catch (error) {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    loadUsuarios();
  }, [status, isAdmin, router, loadUsuarios]);

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingId(userId);
    try {
      const response = await fetch(`/api/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar papel");

      setUsuarios((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      );
      toast.success("Papel atualizado com sucesso");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar papel");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/usuarios/convites/${inviteId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Erro ao revogar convite");

      setConvites((prev) => prev.filter((c) => c.id !== inviteId));
      toast.success("Convite revogado");
    } catch (error) {
      toast.error("Erro ao revogar convite");
    }
  };

  if (status === "loading" || !isAdmin) {
    return (
      <div className="container mx-auto max-w-[1400px] p-6">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        eyebrow="Sistema"
        title="Usuários e permissões"
        subtitle="Quem acessa o quê, incluindo acessos externos de leitura."
        actions={
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Convidar usuário
          </Button>
        }
      />

      <SectionCard title="Usuários" contentClassName="p-0">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead className="pl-4">Usuário</DataTableHead>
                <DataTableHead>Papel</DataTableHead>
                <DataTableHead>Acesso a</DataTableHead>
                <DataTableHead>Desde</DataTableHead>
                <DataTableHead className="pr-4">Situação</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {usuarios.map((usuario) => {
                const isSelf = usuario.id === session?.user?.id;
                return (
                  <DataTableRow key={usuario.id}>
                    <DataTableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Thumb
                          initials={getInitials(usuario.name, usuario.email)}
                          tone={usuario.role === "ADMIN" ? "primary" : "info"}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {usuario.name || "Sem nome"}
                          </p>
                          <p className="truncate text-xs text-faint">
                            {usuario.email}
                          </p>
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      {isSelf ? (
                        <StatusPill tone={usuario.role === "ADMIN" ? "primary" : "neutral"}>
                          {ROLE_LABELS[usuario.role] || usuario.role}
                        </StatusPill>
                      ) : (
                        <Select
                          value={usuario.role}
                          onValueChange={(role) => handleRoleChange(usuario.id, role)}
                          disabled={updatingId === usuario.id}
                        >
                          <SelectTrigger className="h-8 w-[168px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-muted-foreground">
                      {ROLE_ESCOPO[usuario.role] || "—"}
                    </DataTableCell>
                    <DataTableCell numeric className="text-muted-foreground">
                      {new Date(usuario.createdAt).toLocaleDateString("pt-BR")}
                    </DataTableCell>
                    <DataTableCell className="pr-4">
                      <StatusPill tone="success">Ativo</StatusPill>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}

              {convites.map((convite) => (
                <DataTableRow key={convite.id}>
                  <DataTableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Thumb initials={getInitials(null, convite.email)} tone="warning" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {convite.email}
                        </p>
                        <p className="text-xs text-faint">
                          Convite expira em{" "}
                          {new Date(convite.expiresAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusPill tone="neutral">
                      {ROLE_LABELS[convite.role] || convite.role}
                    </StatusPill>
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {ROLE_ESCOPO[convite.role] || "—"}
                  </DataTableCell>
                  <DataTableCell numeric className="text-muted-foreground">
                    —
                  </DataTableCell>
                  <DataTableCell className="pr-4">
                    <div className="flex items-center gap-2">
                      <StatusPill tone="warning">Convite pendente</StatusPill>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeInvite(convite.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}

              {usuarios.length === 0 && convites.length === 0 && (
                <DataTableRow>
                  <DataTableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </DataTableCell>
                </DataTableRow>
              )}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>

      <UsuarioConviteDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onInvited={loadUsuarios}
      />
    </div>
  );
}
