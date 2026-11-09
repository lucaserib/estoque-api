"use client";

import { useEffect, useState } from "react";
import {
  CamposAceite,
  CamposLoja,
  DADOS_LOJA_VAZIOS,
  codigoDoCookieDeOrigem,
  type Aceites,
  type DadosLoja,
} from "@/components/cadastro/CamposLoja";

interface PerfilInicial {
  nomeLoja: string | null;
  whatsapp: string | null;
  faixaPedidosMes: string | null;
  canais: string[];
  comoConheceu: string | null;
}

export function FormularioBoasVindas({
  nome,
  dono,
  perfilInicial,
}: {
  nome: string | null;
  dono: boolean;
  perfilInicial: PerfilInicial | null;
}) {
  const [loja, setLoja] = useState<DadosLoja>({
    ...DADOS_LOJA_VAZIOS,
    nomeLoja: perfilInicial?.nomeLoja ?? "",
    faixaPedidosMes: perfilInicial?.faixaPedidosMes ?? "",
    canais: perfilInicial?.canais ?? [],
    comoConheceu: perfilInicial?.comoConheceu ?? "",
  });
  const [whatsapp, setWhatsapp] = useState(perfilInicial?.whatsapp?.replace(/^\+55/, "") ?? "");
  const [aceites, setAceites] = useState<Aceites>({ termos: false, marketing: false });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const codigo = codigoDoCookieDeOrigem();
    if (codigo) setLoja((anterior) => ({ ...anterior, codigoIndicacao: anterior.codigoIndicacao || codigo }));
  }, []);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!aceites.termos) {
      setErro("Para continuar, aceite os Termos de uso e a Política de Privacidade.");
      return;
    }
    if (dono && (!loja.nomeLoja.trim() || !loja.faixaPedidosMes)) {
      setErro("Conte o nome da loja e quantos pedidos ela tem por mês.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      const resposta = await fetch("/api/perfil/boas-vindas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(dono ? loja : {}),
          whatsapp: whatsapp || null,
          aceitouTermos: true,
          aceitouMarketing: aceites.marketing,
        }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível salvar.");
      window.location.href = corpo.destino ?? "/";
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setEnviando(false);
    }
  };

  const primeiroNome = nome?.trim().split(/\s+/)[0];

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <div>
        <h1 className="text-[23px] font-semibold leading-tight tracking-tight">
          {primeiroNome ? `Boas-vindas, ${primeiroNome}!` : "Boas-vindas!"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {dono ? "Falta pouco: conte um pouco da sua loja para o Skubo se ajustar a ela." : "Antes de entrar na equipe, confirme os termos."}
        </p>
      </div>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-text">
          {erro}
        </div>
      )}

      {dono && (
        <>
          <CamposLoja dados={loja} aoMudar={setLoja} />
          <div>
            <label htmlFor="whatsapp" className="mb-1 block text-sm font-medium text-foreground">
              WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 99999-9999"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="auth-input h-11 w-full rounded-lg border pl-3"
            />
          </div>
        </>
      )}

      <CamposAceite aceites={aceites} aoMudar={setAceites} />

      <button type="submit" disabled={enviando} className="auth-button flex h-11 w-full items-center justify-center rounded-lg shadow-sm">
        {enviando ? "Salvando..." : "Continuar"}
      </button>
    </form>
  );
}
