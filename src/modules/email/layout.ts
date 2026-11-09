import type { CategoriaEmail } from "@prisma/client";
import { enderecoRodape, linkAbsoluto } from "./config";
import { CORES_EMAIL, botaoHtml, escaparHtml, renderizarMarkdownEmail } from "./markdown";

export interface ConteudoEmail {
  assunto: string;
  preCabecalho: string;
  corpo: string;
  botao?: { rotulo: string; url: string } | null;
  motivo: string;
}

export interface EmailRenderizado {
  assunto: string;
  html: string;
  texto: string;
}

export function montarEmail(
  conteudo: ConteudoEmail,
  opcoes: { categoria: CategoriaEmail; linkDescadastro?: string | null }
): EmailRenderizado {
  const cores = CORES_EMAIL;
  const corpo = renderizarMarkdownEmail(conteudo.corpo, cores);
  const botao = conteudo.botao ? botaoHtml(conteudo.botao.rotulo, linkAbsoluto(conteudo.botao.url), cores) : "";
  const icone = linkAbsoluto("/brand/skubo/icon-192.png");
  const mostrarDescadastro = opcoes.categoria !== "TRANSACIONAL" && opcoes.linkDescadastro;

  const rodapeHtml = [
    escaparHtml(conteudo.motivo),
    mostrarDescadastro
      ? `<a href="${escaparHtml(opcoes.linkDescadastro!)}" style="color:${cores.suave};text-decoration:underline;">Não quero mais receber estes e-mails</a>`
      : null,
    escaparHtml(enderecoRodape()),
  ]
    .filter(Boolean)
    .join("<br>");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escaparHtml(conteudo.assunto)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .skubo-fundo { background:#120F22 !important; }
  .skubo-cartao { background:#1C1833 !important; border-color:#2E2950 !important; }
  .skubo-cartao p, .skubo-cartao li, .skubo-cartao h2, .skubo-marca { color:#F1EFFC !important; }
  .skubo-rodape { color:#A9A4C7 !important; }
}
@media only screen and (max-width: 620px) {
  .skubo-cartao { padding:24px 20px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#F6F5FD;" class="skubo-fundo">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escaparHtml(conteudo.preCabecalho)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F5FD;" class="skubo-fundo">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:0 4px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="${escaparHtml(icone)}" width="32" height="32" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:${cores.texto};" class="skubo-marca">Skubo</td>
</tr></table>
</td></tr>
<tr><td class="skubo-cartao" style="background:${cores.fundoCartao};border:1px solid ${cores.borda};border-radius:16px;padding:32px;">
${corpo.html}
${botao}
</td></tr>
<tr><td class="skubo-rodape" style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:${cores.suave};">${rodapeHtml}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const texto = [
    corpo.texto,
    conteudo.botao ? `${conteudo.botao.rotulo}: ${linkAbsoluto(conteudo.botao.url)}` : null,
    "—",
    conteudo.motivo,
    mostrarDescadastro ? `Para não receber mais: ${opcoes.linkDescadastro}` : null,
    enderecoRodape(),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { assunto: conteudo.assunto, html, texto };
}
