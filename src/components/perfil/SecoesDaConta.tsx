"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Download, LogOut, Mail, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateBR } from "@/lib/format";

interface Preferencias {
  marketingEmail: boolean;
  marketingWhatsapp: boolean;
  cicloDeVida: boolean;
}

const OPCOES: Array<{ chave: keyof Preferencias; titulo: string; descricao: string }> = [
  { chave: "cicloDeVida", titulo: "Dicas para usar o Skubo", descricao: "Lembretes de configuração, do teste e da IA." },
  { chave: "marketingEmail", titulo: "Novidades e ofertas por e-mail", descricao: "Lançamentos, promoções e conteúdo para vender mais." },
  { chave: "marketingWhatsapp", titulo: "Novidades e ofertas por WhatsApp", descricao: "As mesmas novidades, no WhatsApp cadastrado." },
];

function SairDaEquipe() {
  const [saindo, setSaindo] = useState(false);

  const sair = async () => {
    if (!window.confirm("Sair desta equipe? Você perde o acesso aos dados da loja agora. Seu login continua funcionando com uma loja própria.")) {
      return;
    }
    setSaindo(true);
    try {
      const resposta = await fetch("/api/perfil/sair-da-equipe", { method: "POST" });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error);
      toast.success("Você saiu da equipe. Entre de novo para usar sua própria loja.");
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível sair agora.");
      setSaindo(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Equipe
        </CardTitle>
        <CardDescription>Você faz parte da equipe de outra loja.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={sair} disabled={saindo} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sair desta equipe
        </Button>
      </CardContent>
    </Card>
  );
}

function Comunicacoes() {
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [salvando, setSalvando] = useState<keyof Preferencias | null>(null);

  useEffect(() => {
    fetch("/api/perfil/preferencias")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => dados && setPreferencias(dados))
      .catch(() => {});
  }, []);

  const alterar = async (chave: keyof Preferencias, valor: boolean) => {
    if (!preferencias) return;
    const anterior = preferencias;
    setPreferencias({ ...preferencias, [chave]: valor });
    setSalvando(chave);
    try {
      const resposta = await fetch("/api/perfil/preferencias", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [chave]: valor }),
      });
      if (!resposta.ok) throw new Error();
      setPreferencias(await resposta.json());
    } catch {
      setPreferencias(anterior);
      toast.error("Não foi possível salvar agora.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Comunicações
        </CardTitle>
        <CardDescription>Recibos, senha e avisos da assinatura chegam sempre.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {OPCOES.map((opcao) => (
          <div key={opcao.chave} className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor={`pref-${opcao.chave}`} className="font-medium">
                {opcao.titulo}
              </Label>
              <p className="text-sm text-muted-foreground">{opcao.descricao}</p>
            </div>
            <Switch
              id={`pref-${opcao.chave}`}
              checked={preferencias?.[opcao.chave] ?? false}
              disabled={!preferencias || salvando === opcao.chave}
              onCheckedChange={(valor) => alterar(opcao.chave, valor)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Privacidade() {
  const [pendente, setPendente] = useState<{ createdAt: string } | null>(null);
  const [pedindo, setPedindo] = useState(false);

  useEffect(() => {
    fetch("/api/perfil/exclusao")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => dados?.pendente && setPendente(dados.pendente))
      .catch(() => {});
  }, []);

  const pedirExclusao = async () => {
    const motivo = window.prompt(
      "Pedir a exclusão da sua conta? A equipe Skubo confirma com você antes de apagar. Se quiser, conte o motivo:"
    );
    if (motivo === null) return;
    setPedindo(true);
    try {
      const resposta = await fetch("/api/perfil/exclusao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error);
      setPendente(corpo.pendente);
      toast.success("Pedido registrado. Vamos falar com você pelo e-mail da conta.");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não foi possível registrar agora.");
    } finally {
      setPedindo(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Privacidade e seus dados
        </CardTitle>
        <CardDescription>
          Seus direitos pela LGPD. Veja também a{" "}
          <a href="/privacidade" className="text-primary hover:underline" target="_blank" rel="noreferrer">
            Política de Privacidade
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline" className="gap-2">
          <a href="/api/perfil/meus-dados" download>
            <Download className="h-4 w-4" />
            Baixar meus dados
          </a>
        </Button>
        {pendente ? (
          <p className="text-sm text-muted-foreground sm:self-center">
            Pedido de exclusão feito em {formatDateBR(pendente.createdAt)}. Vamos falar com você pelo e-mail.
          </p>
        ) : (
          <Button variant="outline" onClick={pedirExclusao} disabled={pedindo} className="gap-2 text-destructive-text hover:text-destructive-text">
            <Trash2 className="h-4 w-4" />
            Pedir exclusão da conta
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function SecoesDaConta() {
  const { data: sessao } = useSession();
  const membro = Boolean(sessao?.user && sessao.user.contaId && sessao.user.contaId !== sessao.user.id);

  return (
    <>
      {membro && <SairDaEquipe />}
      <Comunicacoes />
      <Privacidade />
    </>
  );
}
