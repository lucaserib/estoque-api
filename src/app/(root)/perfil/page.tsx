"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Bell, Camera, KeyRound, Loader2, Save, ShieldAlert, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import { SecoesDaConta } from "@/components/perfil/SecoesDaConta";

interface Perfil {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  provider: string;
  hasPassword: boolean;
  receberResumoIa: boolean;
  emailTarefas: boolean;
}

export default function PerfilPage() {
  const { update, data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  const [salvandoResumoIa, setSalvandoResumoIa] = useState(false);
  const [salvandoEmailTarefas, setSalvandoEmailTarefas] = useState(false);

  const alterarEmailTarefas = async (emailTarefas: boolean) => {
    if (!perfil) return;
    setSalvandoEmailTarefas(true);
    setPerfil({ ...perfil, emailTarefas });
    try {
      const response = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailTarefas }),
      });
      if (!response.ok) throw new Error();
      toast.success(emailTarefas ? "Você vai receber os avisos de tarefas por e-mail." : "Avisos de tarefas por e-mail desligados.");
    } catch {
      setPerfil({ ...perfil, emailTarefas: !emailTarefas });
      toast.error("Não foi possível salvar a preferência.");
    } finally {
      setSalvandoEmailTarefas(false);
    }
  };

  const alterarResumoIa = async (receberResumoIa: boolean) => {
    if (!perfil) return;
    setSalvandoResumoIa(true);
    setPerfil({ ...perfil, receberResumoIa });
    try {
      const response = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receberResumoIa }),
      });
      if (!response.ok) throw new Error();
      toast.success(receberResumoIa ? "Você vai receber o resumo semanal." : "Resumo semanal desligado.");
    } catch {
      setPerfil({ ...perfil, receberResumoIa: !receberResumoIa });
      toast.error("Não foi possível salvar a preferência.");
    } finally {
      setSalvandoResumoIa(false);
    }
  };

  useEffect(() => {
    const loadPerfil = async () => {
      try {
        const response = await fetch("/api/perfil");
        if (!response.ok) throw new Error("Erro ao carregar perfil");
        const data: Perfil = await response.json();
        setPerfil(data);
        setNome(data.name || "");
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        toast.error("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    };

    loadPerfil();
  }, []);

  const handleSalvarPerfil = async () => {
    setSavingPerfil(true);
    try {
      const response = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nome }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao salvar perfil");
        return;
      }

      setPerfil((prev) => (prev ? { ...prev, name: data.name } : prev));
      await update({ name: data.name });
      toast.success("Perfil atualizado com sucesso");
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error("Erro ao salvar perfil");
    } finally {
      setSavingPerfil(false);
    }
  };

  const handleAvatarSelecionado = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/perfil/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao enviar avatar");
        return;
      }

      setPerfil((prev) => (prev ? { ...prev, image: data.image } : prev));
      await update({ image: data.image });
      toast.success("Avatar atualizado com sucesso");
    } catch (error) {
      console.error("Erro ao enviar avatar:", error);
      toast.error("Erro ao enviar avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAlterarSenha = async () => {
    if (novaSenha !== confirmarSenha) {
      toast.error("A confirmação de senha não corresponde à nova senha");
      return;
    }

    setSavingSenha(true);
    try {
      const response = await fetch("/api/perfil/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao alterar senha");
        return;
      }

      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
      toast.success("Senha alterada com sucesso");
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      toast.error("Erro ao alterar senha");
    } finally {
      setSavingSenha(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader title="Meu perfil" subtitle="Dados da sua conta" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title="Meu perfil" subtitle="Dados da sua conta" />
        <Alert variant="destructive">
          <AlertDescription>Não foi possível carregar o perfil.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <PageHeader title="Meu perfil" subtitle="Dados da sua conta" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados pessoais
          </CardTitle>
          <CardDescription>
            Membro desde {formatDateBR(perfil.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar
                name={perfil.name}
                email={perfil.email}
                image={perfil.image}
                size={72}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted"
                aria-label="Alterar avatar"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleAvatarSelecionado(file);
                  event.target.value = "";
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              JPG, PNG ou WEBP, até 2 MB.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="perfil-nome">Nome</Label>
            <Input
              id="perfil-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={savingPerfil}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="perfil-email">E-mail</Label>
            <Input id="perfil-email" value={perfil.email} disabled readOnly />
          </div>

          <Button
            onClick={handleSalvarPerfil}
            disabled={savingPerfil || nome.trim().length < 2}
          >
            {savingPerfil ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar alterações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Tarefas
          </CardTitle>
          <CardDescription>Avisos da operação da loja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="email-tarefas" className="font-medium">
                Avisos de tarefas por e-mail
              </Label>
              <p className="text-sm text-muted-foreground">
                Quando passarem uma tarefa para você ou te mencionarem, e o resumo do dia às 8h com o que está atrasado ou vence hoje. No app, os avisos chegam sempre.
              </p>
            </div>
            <Switch id="email-tarefas" checked={perfil.emailTarefas} onCheckedChange={alterarEmailTarefas} disabled={salvandoEmailTarefas} />
          </div>
        </CardContent>
      </Card>

      {session?.user?.role === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>O que o Skubo avisa para você</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="receber-resumo-ia" className="font-medium">
                  Resumo semanal do Skubo IA
                </Label>
                <p className="text-sm text-muted-foreground">
                  Toda segunda de manhã, as 3 prioridades da semana na Central de controle (para contas com o Skubo IA).
                </p>
              </div>
              <Switch
                id="receber-resumo-ia"
                checked={perfil.receberResumoIa}
                onCheckedChange={alterarResumoIa}
                disabled={salvandoResumoIa}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Segurança
          </CardTitle>
          <CardDescription>Alterar a senha de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!perfil.hasPassword ? (
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Esta conta entra com o Google. Para criar uma senha também, use
                &quot;Esqueci minha senha&quot; na tela de login.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="senha-atual">Senha atual</Label>
                <Input
                  id="senha-atual"
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  disabled={savingSenha}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova senha</Label>
                  <Input
                    id="nova-senha"
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    disabled={savingSenha}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
                  <Input
                    id="confirmar-senha"
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    disabled={savingSenha}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                A nova senha deve ter ao menos 8 caracteres, com letra e
                número.
              </p>

              <Button
                onClick={handleAlterarSenha}
                disabled={
                  savingSenha || !senhaAtual || !novaSenha || !confirmarSenha
                }
              >
                {savingSenha ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4 mr-2" />
                )}
                Alterar senha
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <SecoesDaConta />
    </div>
  );
}
