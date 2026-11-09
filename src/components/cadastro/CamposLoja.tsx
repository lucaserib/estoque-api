"use client";

import Link from "next/link";
import { CheckCircle2, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoDoBonus, useConvite } from "./useConvite";

export const OPCOES_FAIXA = [
  { valor: "ATE_30", rotulo: "Até 30" },
  { valor: "DE_31_A_200", rotulo: "31 a 200" },
  { valor: "DE_201_A_700", rotulo: "201 a 700" },
  { valor: "DE_701_A_1500", rotulo: "701 a 1.500" },
  { valor: "MAIS_DE_1500", rotulo: "Mais de 1.500" },
];

export const OPCOES_CANAIS = [
  { valor: "MERCADO_LIVRE", rotulo: "Mercado Livre" },
  { valor: "SHOPEE", rotulo: "Shopee" },
  { valor: "AMAZON", rotulo: "Amazon" },
  { valor: "LOJA_PROPRIA", rotulo: "Loja própria" },
  { valor: "OUTROS", rotulo: "Outros" },
];

export const OPCOES_ORIGEM = [
  { valor: "INSTAGRAM", rotulo: "Instagram" },
  { valor: "YOUTUBE", rotulo: "YouTube" },
  { valor: "INDICACAO", rotulo: "Indicação" },
  { valor: "GOOGLE", rotulo: "Google" },
  { valor: "GRUPO_WHATSAPP", rotulo: "Grupo de WhatsApp" },
  { valor: "OUTRO", rotulo: "Outro" },
];

export interface DadosLoja {
  nomeLoja: string;
  faixaPedidosMes: string;
  canais: string[];
  comoConheceu: string;
  codigoIndicacao: string;
}

export interface Aceites {
  termos: boolean;
  marketing: boolean;
}

export const DADOS_LOJA_VAZIOS: DadosLoja = { nomeLoja: "", faixaPedidosMes: "", canais: [], comoConheceu: "", codigoIndicacao: "" };

const rotulo = "mb-1 block text-sm font-medium text-foreground";
const campo = "auth-input h-11 w-full rounded-lg border pl-3";

export function CamposLoja({
  dados,
  aoMudar,
  mostrarCodigo = true,
}: {
  dados: DadosLoja;
  aoMudar: (dados: DadosLoja) => void;
  mostrarCodigo?: boolean;
}) {
  const alternarCanal = (valor: string) =>
    aoMudar({
      ...dados,
      canais: dados.canais.includes(valor) ? dados.canais.filter((c) => c !== valor) : [...dados.canais, valor],
    });

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="nomeLoja" className={rotulo}>
          Nome da loja
        </label>
        <input
          id="nomeLoja"
          value={dados.nomeLoja}
          onChange={(e) => aoMudar({ ...dados, nomeLoja: e.target.value })}
          placeholder="Como sua loja se chama"
          maxLength={120}
          required
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="faixaPedidosMes" className={rotulo}>
          Pedidos por mês
        </label>
        <select
          id="faixaPedidosMes"
          value={dados.faixaPedidosMes}
          onChange={(e) => aoMudar({ ...dados, faixaPedidosMes: e.target.value })}
          required
          className={cn(campo, "bg-transparent pr-3")}
        >
          <option value="" disabled>
            Selecione
          </option>
          {OPCOES_FAIXA.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={rotulo}>Onde você vende</legend>
        <div className="flex flex-wrap gap-2">
          {OPCOES_CANAIS.map((opcao) => {
            const ativo = dados.canais.includes(opcao.valor);
            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarCanal(opcao.valor)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  ativo ? "border-primary bg-primary/[0.12] text-primary" : "border-border text-foreground hover:bg-muted"
                )}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="comoConheceu" className={rotulo}>
          Como conheceu o Skubo
        </label>
        <select
          id="comoConheceu"
          value={dados.comoConheceu}
          onChange={(e) => aoMudar({ ...dados, comoConheceu: e.target.value })}
          className={cn(campo, "bg-transparent pr-3")}
        >
          <option value="">Prefiro não dizer</option>
          {OPCOES_ORIGEM.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </div>

      {mostrarCodigo && <CampoCodigo valor={dados.codigoIndicacao} aoMudar={(codigoIndicacao) => aoMudar({ ...dados, codigoIndicacao })} />}
    </div>
  );
}

function CampoCodigo({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  const convite = useConvite(valor);
  return (
    <div>
      <label htmlFor="codigoIndicacao" className={rotulo}>
        Código de indicação <span className="font-normal text-muted-foreground">(opcional)</span>
      </label>
      <input
        id="codigoIndicacao"
        value={valor}
        onChange={(e) => aoMudar(e.target.value.toUpperCase())}
        placeholder="SKU-XXXX"
        maxLength={20}
        autoCapitalize="characters"
        aria-describedby="codigoIndicacao-ajuda"
        aria-invalid={convite.estado === "invalido"}
        className={cn(campo, convite.estado === "invalido" && "border-warning")}
      />
      <p id="codigoIndicacao-ajuda" role="status" className="mt-1 min-h-[1rem] text-xs">
        {convite.estado === "valido" && (
          <span className="flex items-center gap-1 text-success-text">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {convite.convidadoPor ? `Convite de ${convite.convidadoPor}` : "Código válido"}
            {textoDoBonus(convite) ? `: você ganha ${textoDoBonus(convite)}.` : "."}
          </span>
        )}
        {convite.estado === "invalido" && <span className="text-warning-text">Código não encontrado. Confira com quem indicou.</span>}
      </p>
    </div>
  );
}

export function BannerConvite({ codigo }: { codigo: string }) {
  const convite = useConvite(codigo);
  if (convite.estado !== "valido") return null;
  const bonus = textoDoBonus(convite);
  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/[0.06] p-3 text-sm" data-testid="banner-convite">
      <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="text-foreground">
        {convite.convidadoPor ? <strong>{convite.convidadoPor}</strong> : "Uma loja parceira"} convidou você para o Skubo.
        {bonus ? ` Criando a conta, você ganha ${bonus}.` : ""}
      </p>
    </div>
  );
}

export function CamposAceite({ aceites, aoMudar }: { aceites: Aceites; aoMudar: (aceites: Aceites) => void }) {
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={aceites.termos}
          onChange={(e) => aoMudar({ ...aceites, termos: e.target.checked })}
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span className="text-foreground">
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="font-medium text-primary hover:underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="font-medium text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={aceites.marketing}
          onChange={(e) => aoMudar({ ...aceites, marketing: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        <span className="text-muted-foreground">Quero receber novidades e ofertas por e-mail e WhatsApp.</span>
      </label>
    </div>
  );
}

export function codigoDoCookieDeOrigem(): string {
  try {
    const valor = document.cookie.split("; ").find((parte) => parte.startsWith("skubo_origem="))?.split("=")[1];
    if (!valor) return "";
    const ref = JSON.parse(decodeURIComponent(valor))?.ref;
    return typeof ref === "string" ? ref : "";
  } catch {
    return "";
  }
}
