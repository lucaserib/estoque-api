export const CHART_COLORS = ["#5B3DF5", "#16C79A", "#F59E0B", "#3B82F6", "#EC4899"] as const;

export const chartColor = (index: number): string => CHART_COLORS[index % CHART_COLORS.length];
