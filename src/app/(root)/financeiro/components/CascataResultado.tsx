"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL, formatPercent } from "@/lib/format";

interface DreMensalParaCascata {
  faturamento: number;
  impostosSobreVendas: number;
  custosVariaveis: {
    tarifas: number;
    frete: number;
    ads: number;
    armazenagemFull: number;
    outrasCobrancas: number;
    outrosCustos: number;
  };
  cmv: number;
  margemContribuicao: number;
  totalDespesasOperacionais: number;
  lucroLiquido: number;
}

interface PassoCascata {
  nome: string;
  nomeCompleto: string;
  base: number;
  valor: number;
  deltaReal: number;
  ancora: boolean;
}

function construirCascata(mes: DreMensalParaCascata): PassoCascata[] {
  const cobrancas = mes.custosVariaveis.armazenagemFull + mes.custosVariaveis.outrasCobrancas + mes.custosVariaveis.outrosCustos;
  const passos: Array<{ nome: string; nomeCompleto: string; delta: number; ancora: boolean }> = [
    { nome: "Faturamento", nomeCompleto: "Faturamento", delta: mes.faturamento, ancora: true },
    { nome: "Impostos", nomeCompleto: "Impostos sobre vendas", delta: -mes.impostosSobreVendas, ancora: false },
    { nome: "Tarifas", nomeCompleto: "Tarifas do Mercado Livre", delta: -mes.custosVariaveis.tarifas, ancora: false },
    { nome: "Frete", nomeCompleto: "Frete", delta: -mes.custosVariaveis.frete, ancora: false },
    { nome: "Ads", nomeCompleto: "Publicidade", delta: -mes.custosVariaveis.ads, ancora: false },
    { nome: "Fatura ML", nomeCompleto: "Fatura do ML (Full e outras cobranças)", delta: -cobrancas, ancora: false },
    { nome: "CMV", nomeCompleto: "Custo das mercadorias (CMV)", delta: -mes.cmv, ancora: false },
    { nome: "Margem", nomeCompleto: "Margem de contribuição", delta: mes.margemContribuicao, ancora: true },
    { nome: "Despesas", nomeCompleto: "Despesas operacionais", delta: -mes.totalDespesasOperacionais, ancora: false },
    { nome: "Lucro líquido", nomeCompleto: "Lucro líquido", delta: mes.lucroLiquido, ancora: true },
  ];

  let cumulativo = 0;
  return passos.map((passo) => {
    if (passo.ancora) {
      cumulativo = passo.delta;
      return { nome: passo.nome, nomeCompleto: passo.nomeCompleto, base: 0, valor: passo.delta, deltaReal: passo.delta, ancora: true };
    }
    const inicio = cumulativo;
    cumulativo += passo.delta;
    return {
      nome: passo.nome,
      nomeCompleto: passo.nomeCompleto,
      base: Math.min(inicio, cumulativo),
      valor: Math.abs(passo.delta),
      deltaReal: passo.delta,
      ancora: false,
    };
  });
}

function corDaBarra(passo: PassoCascata): string {
  if (passo.nome === "Lucro líquido") return passo.deltaReal >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))";
  if (passo.ancora) return "hsl(var(--primary))";
  return "hsl(var(--destructive) / 0.85)";
}

function RotuloEixo({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">
      {payload?.value}
    </text>
  );
}

export function CascataResultado({ mes }: { mes: DreMensalParaCascata }) {
  const dados = construirCascata(mes);
  const base = mes.faturamento || 1;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="nome" interval={0} tick={<RotuloEixo />} height={50} />
        <YAxis tickFormatter={(v) => formatBRL(v)} width={90} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(_valor: number, _nome: string, item: { payload?: PassoCascata }) => {
            const passo = item.payload;
            if (!passo) return "";
            return [`${formatBRL(passo.deltaReal)} (${formatPercent((passo.deltaReal / base) * 100)})`, passo.nomeCompleto];
          }}
          labelFormatter={() => ""}
        />
        <Bar dataKey="base" stackId="cascata" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="valor" stackId="cascata" radius={[2, 2, 0, 0]}>
          {dados.map((passo) => (
            <Cell key={passo.nome} fill={corDaBarra(passo)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
