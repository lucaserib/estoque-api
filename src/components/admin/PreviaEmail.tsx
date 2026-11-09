"use client";

import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { montarEmail } from "@/modules/email/layout";
import { substituirVariaveis } from "@/modules/email/markdown";

const EXEMPLO = {
  nome: "Ana",
  loja: "loja Ana Store",
  link_indicacao: "https://skubo.com.br/r/SKU-AB12",
  dias_teste: 7,
  saldo_ia: 5,
  link_planos: "https://skubo.com.br/planos",
  data_fim_teste: "21/11/2026",
  data_renovacao: "05/12/2026",
  valor: "R$ 389,70",
  dias: 7,
  indicado: "Lo** St***",
  cupom: "VOLTA20",
  pesquisa: "- [Ficou caro para mim](#)\n- [Faltou algum recurso](#)",
  forma: "Seu teste grátis foi estendido.",
};

export function PreviaEmail({
  assunto,
  preCabecalho,
  corpoMarkdown,
  rotuloBotao,
  urlBotao,
  categoria,
}: {
  assunto: string;
  preCabecalho: string;
  corpoMarkdown: string;
  rotuloBotao?: string | null;
  urlBotao?: string | null;
  categoria: "TRANSACIONAL" | "CICLO_DE_VIDA" | "MARKETING";
}) {
  const [largura, setLargura] = useState<"desktop" | "celular">("desktop");
  const html = useMemo(
    () =>
      montarEmail(
        {
          assunto: substituirVariaveis(assunto, EXEMPLO),
          preCabecalho: substituirVariaveis(preCabecalho, EXEMPLO),
          corpo: substituirVariaveis(corpoMarkdown || " ", EXEMPLO),
          botao: rotuloBotao && urlBotao ? { rotulo: rotuloBotao, url: urlBotao } : null,
          motivo: "Você recebeu este e-mail porque tem uma conta no Skubo.",
        },
        { categoria, linkDescadastro: "#" }
      ).html,
    [assunto, preCabecalho, corpoMarkdown, rotuloBotao, urlBotao, categoria]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{substituirVariaveis(assunto, EXEMPLO) || "Sem assunto"}</p>
        <div className="flex gap-1">
          <Button size="sm" variant={largura === "desktop" ? "default" : "outline"} onClick={() => setLargura("desktop")} aria-label="Prévia no computador">
            <Monitor className="h-4 w-4" />
          </Button>
          <Button size="sm" variant={largura === "celular" ? "default" : "outline"} onClick={() => setLargura("celular")} aria-label="Prévia no celular">
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-2">
        <iframe
          title="Prévia do e-mail"
          srcDoc={html}
          sandbox=""
          className="mx-auto block h-[560px] rounded bg-white"
          style={{ width: largura === "desktop" ? 640 : 375 }}
        />
      </div>
    </div>
  );
}
