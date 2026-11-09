"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BannerConvite,
  CamposAceite,
  CamposLoja,
  DADOS_LOJA_VAZIOS,
  codigoDoCookieDeOrigem,
  type Aceites,
  type DadosLoja,
} from "@/components/cadastro/CamposLoja";
import { rastrearMeta } from "@/components/publico/ConsentimentoCookies";

const SENHA_MINIMA = 8;
const rotulo = "mb-1 block text-sm font-medium text-foreground";
const campo = "auth-input h-11 w-full rounded-lg border pl-3";

function RegisterForm() {
  const [acesso, setAcesso] = useState({ name: "", email: "", password: "", whatsapp: "" });
  const [loja, setLoja] = useState<DadosLoja>(DADOS_LOJA_VAZIOS);
  const [aceites, setAceites] = useState<Aceites>({ termos: false, marketing: false });
  const [passo, setPasso] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const refDaUrl = searchParams.get("ref");

  useEffect(() => {
    const codigo = refDaUrl?.trim().toUpperCase() || codigoDoCookieDeOrigem();
    if (codigo) setLoja((anterior) => ({ ...anterior, codigoIndicacao: anterior.codigoIndicacao || codigo }));
  }, [refDaUrl]);

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/convites/${inviteToken}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.email) setAcesso((prev) => ({ ...prev, email: data.email }));
      });
  }, [inviteToken]);

  const validarPrimeiroPasso = (): boolean => {
    if (!acesso.name.trim() || !acesso.email.trim()) {
      setError("Preencha nome e e-mail.");
      return false;
    }
    if (acesso.password.length < SENHA_MINIMA) {
      setError(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return false;
    }
    setError("");
    return true;
  };

  const continuar = () => {
    if (validarPrimeiroPasso()) setPasso(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarPrimeiroPasso()) {
      setPasso(1);
      return;
    }
    if (!inviteToken && (!loja.nomeLoja.trim() || !loja.faixaPedidosMes)) {
      setError("Conte o nome da loja e quantos pedidos ela tem por mês.");
      return;
    }
    if (!aceites.termos) {
      setError("Para criar a conta, aceite os Termos de uso e a Política de Privacidade.");
      return;
    }
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...acesso,
          ...(inviteToken ? {} : loja),
          inviteToken,
          aceitouTermos: aceites.termos,
          aceitouMarketing: aceites.marketing,
        }),
      });

      const corpo = await res.json().catch(() => null);
      if (!res.ok) {
        setError(corpo?.error ?? "Não foi possível criar a conta.");
        return;
      }
      if (corpo?.eventoId) rastrearMeta("CompleteRegistration", corpo.eventoId);

      const entrou = await signIn("credentials", {
        email: acesso.email,
        password: acesso.password,
        redirect: false,
      });
      if (entrou?.ok) {
        window.location.href = inviteToken ? "/" : "/comecar";
        return;
      }
      router.push("/login");
    } catch {
      setError("Ocorreu um erro ao criar sua conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn("google", { callbackUrl: inviteToken ? "/" : "/boas-vindas" });
  };

  return (
    <div className="w-full">
      <h1 className="text-[23px] font-semibold leading-tight tracking-tight text-foreground">Crie sua conta</h1>
      <p className="mb-7 mt-2 text-sm text-muted-foreground">
        {inviteToken
          ? "Você foi convidado para o Skubo. Defina sua senha para concluir o cadastro."
          : "7 dias grátis, sem cartão. Comece a controlar seu estoque em minutos."}
      </p>

      <div className={cn(passo === 2 && "hidden sm:block")}>
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="auth-button flex h-11 w-full items-center justify-center gap-2 rounded-lg shadow-sm"
        >
          <FcGoogle size={22} />
          <span>Cadastrar com o Google</span>
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border"></span>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">ou use seu e-mail</span>
          </div>
        </div>
      </div>

      {!inviteToken && refDaUrl && <BannerConvite codigo={refDaUrl} />}

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-text">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className={cn("space-y-4", passo === 2 && "hidden sm:block")}>
          <div>
            <label htmlFor="email" className={rotulo}>
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Seu e-mail"
              value={acesso.email}
              onChange={(e) => setAcesso({ ...acesso, email: e.target.value })}
              required
              readOnly={!!inviteToken}
              className={cn(campo, "read-only:opacity-60")}
            />
          </div>
          <div>
            <label htmlFor="name" className={rotulo}>
              Seu nome
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Nome e sobrenome"
              value={acesso.name}
              onChange={(e) => setAcesso({ ...acesso, name: e.target.value })}
              required
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="password" className={rotulo}>
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={SENHA_MINIMA}
              autoComplete="new-password"
              placeholder={`Pelo menos ${SENHA_MINIMA} caracteres`}
              value={acesso.password}
              onChange={(e) => setAcesso({ ...acesso, password: e.target.value })}
              required
              className={campo}
            />
          </div>
          {!inviteToken && (
            <div>
              <label htmlFor="whatsapp" className={rotulo}>
                WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 99999-9999"
                value={acesso.whatsapp}
                onChange={(e) => setAcesso({ ...acesso, whatsapp: e.target.value })}
                className={campo}
              />
            </div>
          )}
          {!inviteToken && (
            <button
              type="button"
              onClick={continuar}
              className="auth-button flex h-11 w-full items-center justify-center rounded-lg shadow-sm sm:hidden"
            >
              Continuar
            </button>
          )}
        </div>

        <div className={cn("space-y-4", !inviteToken && passo === 1 && "hidden sm:block")}>
          {!inviteToken && (
            <>
              <button
                type="button"
                onClick={() => setPasso(1)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
              <p className="border-t border-border pt-4 text-sm font-medium text-foreground sm:border-t-0 sm:pt-2">
                Sobre a sua loja
              </p>
              <CamposLoja dados={loja} aoMudar={setLoja} />
            </>
          )}
          <CamposAceite aceites={aceites} aoMudar={setAceites} />
          <button
            type="submit"
            disabled={isLoading}
            className="auth-button flex h-11 w-full items-center justify-center rounded-lg shadow-sm"
          >
            {isLoading ? "Criando conta..." : "Criar conta"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1">
        <div className="text-sm">
          <span className="text-muted-foreground">Já tem uma conta? </span>
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Faça login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
