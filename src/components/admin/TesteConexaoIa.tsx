"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiagnosticoConexaoIa } from "@/modules/ia/diagnosticoConexao";

function Item({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-text" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive-text" />}
      <span className="text-fg2">{texto}</span>
    </li>
  );
}

export function TesteConexaoIa() {
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<DiagnosticoConexaoIa | null>(null);
  const [falha, setFalha] = useState(false);

  const testar = async () => {
    setTestando(true);
    setFalha(false);
    try {
      const resposta = await fetch("/api/admin/ia/teste", { method: "POST" });
      if (!resposta.ok) throw new Error();
      setResultado(await resposta.json());
    } catch {
      setFalha(true);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={testar} disabled={testando} className="gap-2">
        {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
        Testar conexão com a IA
      </Button>
      {falha && <p className="text-sm text-destructive-text">Não foi possível rodar o teste.</p>}
      {resultado && (
        <ul className="space-y-1.5" data-testid="resultado-teste-ia">
          <Item ok={resultado.configurada} texto={resultado.configurada ? "Chave configurada" : "ANTHROPIC_API_KEY ausente"} />
          <Item ok={!resultado.desligada} texto={resultado.desligada ? "IA_DESLIGADA=1: clientes não usam a IA" : "IA ligada para os clientes"} />
          <Item ok={!resultado.provedorFalso} texto={resultado.provedorFalso ? "IA_PROVEDOR_FALSO ligado: respostas de teste!" : "Provedor real (Anthropic)"} />
          <Item ok={resultado.precosConfigurados} texto={resultado.precosConfigurados ? "Preços configurados (custo estimado ativo)" : "Sem IA_PRECO_*: limite conta mensagens"} />
          {resultado.modelos.map((m) => (
            <Item
              key={m.modelo}
              ok={m.ok}
              texto={
                m.ok
                  ? `${m.modelo} (${m.papel}) respondeu em ${m.duracaoMs} ms`
                  : `${m.modelo} (${m.papel}) falhou: ${m.erro}${resultado.workspaceDefinido ? "" : " — se a chave for de usuário (sk-ant-usr), defina ANTHROPIC_WORKSPACE_ID"}`
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
