"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MOTIVOS = [
  { motivo: "PRECO", rotulo: "Ficou caro para mim" },
  { motivo: "FALTOU_RECURSO", rotulo: "Faltou algum recurso" },
  { motivo: "DIFICIL", rotulo: "Achei difícil de usar" },
  { motivo: "PAROU_DE_VENDER", rotulo: "Parei de vender" },
  { motivo: "OUTRA_FERRAMENTA", rotulo: "Fui para outra ferramenta" },
  { motivo: "OUTRO", rotulo: "Outro motivo" },
];

async function enviarResposta(token: string, dados: { motivo: string; comentario?: string }) {
  const resposta = await fetch("/api/pesquisa/cancelamento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token, ...dados }),
  });
  if (!resposta.ok) throw new Error();
}

export function RespostaCancelamento() {
  const parametros = useSearchParams();
  const token = parametros.get("t") ?? "";
  const [motivo, setMotivo] = useState(parametros.get("m") ?? "");
  const [comentario, setComentario] = useState("");
  const [estado, setEstado] = useState<"enviando" | "ok" | "erro" | "agradecido">("enviando");
  const enviadoInicial = useRef(false);

  useEffect(() => {
    if (enviadoInicial.current) return;
    enviadoInicial.current = true;
    if (!token || !MOTIVOS.some((m) => m.motivo === motivo)) {
      setEstado(token ? "ok" : "erro");
      return;
    }
    enviarResposta(token, { motivo })
      .then(() => setEstado("ok"))
      .catch(() => setEstado("erro"));
  }, [token, motivo]);

  const salvar = async () => {
    setEstado("enviando");
    try {
      await enviarResposta(token, { motivo, comentario });
      setEstado("agradecido");
    } catch {
      setEstado("erro");
    }
  };

  if (estado === "erro") {
    return (
      <Card>
        <CardContent className="p-6 text-sm">Este link não é válido. Se quiser, responda o e-mail contando o motivo.</CardContent>
      </Card>
    );
  }

  if (estado === "agradecido") {
    return (
      <Card>
        <CardContent className="flex items-start gap-3 p-6">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-text" />
          <p className="text-sm">Obrigado! Sua resposta vai direto para quem decide o que o Skubo faz a seguir.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div>
          <h1 className="text-lg font-semibold">Obrigado por responder</h1>
          <p className="mt-1 text-sm text-muted-foreground">Se quiser, ajuste o motivo e conte um pouco mais.</p>
        </div>
        <div className="grid gap-2" role="radiogroup" aria-label="Motivo do cancelamento">
          {MOTIVOS.map((opcao) => (
            <button
              key={opcao.motivo}
              type="button"
              role="radio"
              aria-checked={motivo === opcao.motivo}
              onClick={() => setMotivo(opcao.motivo)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                motivo === opcao.motivo ? "border-primary bg-primary/[0.08] text-primary" : "border-border hover:bg-muted"
              }`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Quer contar mais? (opcional)"
          maxLength={1000}
          rows={3}
        />
        <Button onClick={salvar} disabled={!motivo || estado === "enviando"} className="w-full sm:w-auto">
          {estado === "enviando" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
        </Button>
      </CardContent>
    </Card>
  );
}
