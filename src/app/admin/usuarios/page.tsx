"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { DialogoAcaoAdmin, PainelAdmin, TabelaAdmin, chamarAdmin } from "@/components/admin/ui";
import { formatDateBR } from "@/lib/format";

interface Usuario {
  id: string;
  name: string | null;
  email: string;
  role: string;
  dono: boolean;
  contaId: string;
  loja: string | null;
  emailDono: string;
  entraCom: "SENHA" | "GOOGLE";
  emailVerificadoEm: string | null;
  bloqueadoEm: string | null;
  ultimoLoginEm: string | null;
  createdAt: string;
}

type Acao = "enviar-redefinicao" | "reenviar-confirmacao" | "bloquear" | "desbloquear";
const TITULOS: Record<Acao, string> = {
  "enviar-redefinicao": "Enviar link para redefinir a senha",
  "reenviar-confirmacao": "Reenviar a confirmação de e-mail",
  bloquear: "Bloquear o usuário",
  desbloquear: "Desbloquear o usuário",
};

export default function AdminUsuariosPage() {
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [acao, setAcao] = useState<{ tipo: Acao; usuario: Usuario } | null>(null);

  useEffect(() => {
    const inicial = new URLSearchParams(window.location.search).get("busca");
    if (inicial) setBusca(inicial);
  }, []);

  const carregar = useCallback(async (termo: string) => {
    const resposta = await fetch(`/api/admin/usuarios${termo ? `?busca=${encodeURIComponent(termo)}` : ""}`);
    if (resposta.ok) setUsuarios((await resposta.json()).usuarios);
  }, []);

  useEffect(() => {
    const espera = setTimeout(() => carregar(busca), 300);
    return () => clearTimeout(espera);
  }, [busca, carregar]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Plataforma" title="Usuários" subtitle="Busca global por e-mail ou nome, em qualquer conta." />
      <PainelAdmin titulo="Buscar">
        <label className="relative block max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="E-mail ou nome" className="pl-9" aria-label="Buscar usuário" />
        </label>
      </PainelAdmin>
      <PainelAdmin titulo="Resultado">
        {!usuarios ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <TabelaAdmin
            colunas={[{ titulo: "Usuário" }, { titulo: "Conta" }, { titulo: "Papel" }, { titulo: "Situação" }, { titulo: "Último login" }, { titulo: "Ações" }]}
            linhas={usuarios.map((u) => [
              <span key="u" className="block min-w-[180px]">
                <span className="block font-medium">{u.name ?? "Sem nome"}</span>
                <span className="block text-xs text-muted-foreground">
                  {u.email} · {u.entraCom === "GOOGLE" ? "Google" : "senha"}
                </span>
              </span>,
              <Link key="c" href={`/admin/contas/${u.contaId}`} className="hover:underline">
                {u.loja ?? u.emailDono}
                {u.dono ? " (dono)" : ""}
              </Link>,
              u.role,
              <span key="s" className="flex flex-wrap gap-1">
                {u.bloqueadoEm && <StatusPill tone="critical">Bloqueado</StatusPill>}
                <StatusPill tone={u.emailVerificadoEm ? "success" : "warning"}>{u.emailVerificadoEm ? "Verificado" : "Não verificado"}</StatusPill>
              </span>,
              u.ultimoLoginEm ? formatDateBR(u.ultimoLoginEm) : "—",
              <span key="a" className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setAcao({ tipo: "enviar-redefinicao", usuario: u })}>Senha</Button>
                {!u.emailVerificadoEm && (
                  <Button size="sm" variant="ghost" onClick={() => setAcao({ tipo: "reenviar-confirmacao", usuario: u })}>Confirmação</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setAcao({ tipo: u.bloqueadoEm ? "desbloquear" : "bloquear", usuario: u })}>
                  {u.bloqueadoEm ? "Desbloquear" : "Bloquear"}
                </Button>
              </span>,
            ])}
            vazio="Ninguém encontrado."
          />
        )}
      </PainelAdmin>
      <DialogoAcaoAdmin
        aberto={acao !== null}
        aoFechar={() => setAcao(null)}
        titulo={acao ? TITULOS[acao.tipo] : ""}
        descricao={acao?.usuario.email}
        perigoso={acao?.tipo === "bloquear"}
        aoConfirmar={async (motivo) => {
          if (!acao) return;
          await chamarAdmin(`/api/admin/usuarios/${acao.usuario.id}/acoes`, "POST", { acao: acao.tipo, motivo });
          await carregar(busca);
          return "Feito e registrado na auditoria.";
        }}
      />
    </div>
  );
}
