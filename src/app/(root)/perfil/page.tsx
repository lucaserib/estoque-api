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
import { Camera, KeyRound, Loader2, Save, ShieldAlert, User } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";

interface Perfil {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  provider: string;
  hasPassword: boolean;
}

export default function PerfilPage() {
  const { update } = useSession();
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
      <div className="container mx-auto p-6 max-w-2xl space-y-6">
        <PageHeader title="Meu perfil" subtitle="Dados da sua conta" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <PageHeader title="Meu perfil" subtitle="Dados da sua conta" />
        <Alert variant="destructive">
          <AlertDescription>Não foi possível carregar o perfil.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
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
                Esta conta entra apenas com o Google e não tem senha para
                alterar.
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
    </div>
  );
}
