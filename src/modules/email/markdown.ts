export interface CoresEmail {
  primaria: string;
  texto: string;
  suave: string;
  borda: string;
  fundoCartao: string;
}

export const CORES_EMAIL: CoresEmail = {
  primaria: "#5C3DF5",
  texto: "#1B1730",
  suave: "#6B6787",
  borda: "#E6E2F7",
  fundoCartao: "#FFFFFF",
};

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function substituirVariaveis(texto: string, variaveis: Record<string, string | number | null | undefined>): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, nome: string) => {
    const valor = variaveis[nome];
    return valor === null || valor === undefined ? "" : String(valor);
  });
}

function urlSegura(url: string): string | null {
  const limpa = url.trim();
  if (/^https?:\/\//i.test(limpa) || /^mailto:/i.test(limpa)) return limpa;
  return null;
}

function inlineHtml(texto: string, cores: CoresEmail): string {
  let html = escaparHtml(texto);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (original, rotulo: string, url: string) => {
    const segura = urlSegura(url.replace(/&amp;/g, "&"));
    if (!segura) return rotulo;
    return `<a href="${escaparHtml(segura)}" style="color:${cores.primaria};text-decoration:underline;">${rotulo}</a>`;
  });
  return html;
}

function inlineTexto(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, rotulo: string, url: string) => `${rotulo} (${url})`);
}

export function botaoHtml(rotulo: string, url: string, cores: CoresEmail = CORES_EMAIL): string {
  const segura = urlSegura(url);
  if (!segura) return "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="border-radius:10px;background:${cores.primaria};"><a href="${escaparHtml(segura)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escaparHtml(rotulo)}</a></td></tr></table>`;
}

export function renderizarMarkdownEmail(markdown: string, cores: CoresEmail = CORES_EMAIL): { html: string; texto: string } {
  const blocos = markdown.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const html: string[] = [];
  const texto: string[] = [];
  const paragrafo = `margin:0 0 16px;font-size:15px;line-height:1.6;color:${cores.texto};`;

  for (const bloco of blocos) {
    const linhas = bloco.split("\n").map((l) => l.trimEnd());
    const botao = bloco.trim().match(/^\[\[(.+?)\|(.+?)\]\]$/);
    if (botao) {
      html.push(botaoHtml(botao[1].trim(), botao[2].trim(), cores));
      texto.push(`${botao[1].trim()}: ${botao[2].trim()}`);
      continue;
    }
    if (linhas[0].startsWith("## ")) {
      const titulo = linhas[0].slice(3).trim();
      html.push(`<h2 style="margin:8px 0 12px;font-size:18px;line-height:1.35;color:${cores.texto};">${inlineHtml(titulo, cores)}</h2>`);
      texto.push(inlineTexto(titulo).toUpperCase());
      if (linhas.length > 1) {
        const resto = linhas.slice(1).join(" ");
        html.push(`<p style="${paragrafo}">${inlineHtml(resto, cores)}</p>`);
        texto.push(inlineTexto(resto));
      }
      continue;
    }
    if (linhas.every((l) => /^[-*] /.test(l.trim()))) {
      const itens = linhas.map((l) => l.trim().slice(2));
      html.push(
        `<ul style="margin:0 0 16px;padding-left:20px;color:${cores.texto};">${itens
          .map((item) => `<li style="margin:0 0 6px;font-size:15px;line-height:1.55;">${inlineHtml(item, cores)}</li>`)
          .join("")}</ul>`
      );
      texto.push(itens.map((item) => `- ${inlineTexto(item)}`).join("\n"));
      continue;
    }
    if (linhas.every((l) => l.trim().startsWith("> "))) {
      const citacao = linhas.map((l) => l.trim().slice(2)).join(" ");
      html.push(
        `<p style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${cores.primaria};background:#F5F3FF;font-size:15px;line-height:1.55;color:${cores.texto};border-radius:6px;">${inlineHtml(citacao, cores)}</p>`
      );
      texto.push(inlineTexto(citacao));
      continue;
    }
    html.push(`<p style="${paragrafo}">${linhas.map((l) => inlineHtml(l, cores)).join("<br>")}</p>`);
    texto.push(linhas.map(inlineTexto).join("\n"));
  }

  return { html: html.join("\n"), texto: texto.join("\n\n") };
}
