import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { rateLimitResponse } from "@/lib/rateLimit";
import { formatarEventoSse } from "@/lib/sse";
import { type EventoAssistente, gerarTituloConversa, responderPergunta } from "@/modules/ia/assistente";
import { limitarPerguntas } from "@/modules/ia/limite";
import { CABECALHOS_SSE, respostaErroRotaIa } from "@/modules/ia/respostas";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  conversaId: z.string().uuid().nullish(),
  mensagem: z.string().trim().min(1, "Escreva uma pergunta.").max(2000, "A pergunta pode ter até 2000 caracteres."),
  paginaAtual: z.string().max(200).nullish(),
});

export async function POST(request: NextRequest) {
  let usuario: Awaited<ReturnType<typeof verifyUserAtivo>>;
  try {
    usuario = await verifyUserAtivo(request);
  } catch (error) {
    return respostaErroRotaIa(error, "Falha ao autenticar o chat");
  }

  const corpo = corpoSchema.safeParse(await request.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json({ error: corpo.error.issues[0]?.message ?? "Pedido inválido" }, { status: 400 });
  }

  const limite = await limitarPerguntas(usuario.id);
  if (!limite.allowed) return rateLimitResponse(limite);

  const cancelamento = new AbortController();
  request.signal.addEventListener("abort", () => cancelamento.abort(), { once: true });
  const codificador = new TextEncoder();
  const autor = { id: usuario.id, contaId: usuario.contaId, role: usuario.role };

  const fluxo = new ReadableStream<Uint8Array>({
    async start(controlador) {
      const emitir = (evento: EventoAssistente) => {
        if (cancelamento.signal.aborted) return;
        const { tipo, ...dados } = evento;
        try {
          controlador.enqueue(codificador.encode(formatarEventoSse(tipo, dados)));
        } catch {
          cancelamento.abort();
        }
      };

      const resultado = await responderPergunta({
        usuario: autor,
        conversaId: corpo.data.conversaId,
        mensagem: corpo.data.mensagem,
        paginaAtual: corpo.data.paginaAtual,
        sinal: cancelamento.signal,
        emitir,
      });

      if (resultado.novaConversa && resultado.conversaId && resultado.mensagemId && !cancelamento.signal.aborted) {
        const titulo = await gerarTituloConversa(autor, resultado.conversaId, resultado.pergunta, resultado.resposta).catch(
          () => null
        );
        if (titulo) emitir({ tipo: "titulo", conversaId: resultado.conversaId, titulo });
      }

      try {
        controlador.close();
      } catch {}
    },
    cancel() {
      cancelamento.abort();
    },
  });

  return new Response(fluxo, { headers: CABECALHOS_SSE });
}
