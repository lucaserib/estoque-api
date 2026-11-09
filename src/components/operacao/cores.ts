import type { CorOperacao } from "@/modules/operacao/dominio/esquemas";

export const CLASSES_COR: Record<CorOperacao, { chip: string; ponto: string; nota: string; borda: string }> = {
  azul: {
    chip: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
    ponto: "bg-sky-500",
    nota: "bg-sky-50 dark:bg-sky-500/10",
    borda: "border-sky-500/40",
  },
  verde: {
    chip: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    ponto: "bg-emerald-500",
    nota: "bg-emerald-50 dark:bg-emerald-500/10",
    borda: "border-emerald-500/40",
  },
  amarelo: {
    chip: "bg-amber-400/20 text-amber-900 dark:text-amber-200",
    ponto: "bg-amber-400",
    nota: "bg-amber-50 dark:bg-amber-400/10",
    borda: "border-amber-400/50",
  },
  laranja: {
    chip: "bg-orange-500/15 text-orange-800 dark:text-orange-200",
    ponto: "bg-orange-500",
    nota: "bg-orange-50 dark:bg-orange-500/10",
    borda: "border-orange-500/40",
  },
  vermelho: {
    chip: "bg-rose-500/15 text-rose-800 dark:text-rose-200",
    ponto: "bg-rose-500",
    nota: "bg-rose-50 dark:bg-rose-500/10",
    borda: "border-rose-500/40",
  },
  roxo: {
    chip: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
    ponto: "bg-violet-500",
    nota: "bg-violet-50 dark:bg-violet-500/10",
    borda: "border-violet-500/40",
  },
  rosa: {
    chip: "bg-pink-500/15 text-pink-800 dark:text-pink-200",
    ponto: "bg-pink-500",
    nota: "bg-pink-50 dark:bg-pink-500/10",
    borda: "border-pink-500/40",
  },
  cinza: {
    chip: "bg-slate-500/15 text-slate-800 dark:text-slate-200",
    ponto: "bg-slate-500",
    nota: "bg-slate-50 dark:bg-slate-500/10",
    borda: "border-slate-500/40",
  },
};

export const NOMES_COR: Record<CorOperacao, string> = {
  azul: "Azul",
  verde: "Verde",
  amarelo: "Amarelo",
  laranja: "Laranja",
  vermelho: "Vermelho",
  roxo: "Roxo",
  rosa: "Rosa",
  cinza: "Cinza",
};
