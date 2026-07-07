/**
 * Cores centralizadas para gráficos (Recharts).
 * Espelham os tokens --chart-1..5 do tema (styles/global.css).
 */
export const CHART_COLORS = [
  "#059669", // esmeralda (primary)
  "#2563EB", // azul
  "#F59E0B", // âmbar
  "#8B5CF6", // violeta
  "#EC4899", // rosa
] as const;

export const chartColor = (index: number): string =>
  CHART_COLORS[index % CHART_COLORS.length];
