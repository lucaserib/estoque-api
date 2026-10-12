"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/DatePickerWithRange";
import {
  inicioDoDia,
  fimDoDia,
  inicioDoMes,
  fimDoMes,
  somarMeses,
} from "@/modules/financeiro/dominio/periodo";

export type PeriodoPreset = "hoje" | "7dias" | "mesAtual" | "mesAnterior" | "personalizado";

export interface PeriodoSelecionado {
  preset: PeriodoPreset;
  desde: Date;
  ate: Date;
}

const OPCOES: Array<{ value: PeriodoPreset; label: string }> = [
  { value: "hoje", label: "Hoje" },
  { value: "7dias", label: "7 dias" },
  { value: "mesAtual", label: "Mês atual" },
  { value: "mesAnterior", label: "Mês anterior" },
  { value: "personalizado", label: "Personalizado" },
];

export function periodoDoPreset(preset: PeriodoPreset): { desde: Date; ate: Date } {
  const agora = new Date();
  if (preset === "hoje") {
    return { desde: inicioDoDia(agora), ate: fimDoDia(agora) };
  }
  if (preset === "7dias") {
    const seteDiasAtras = new Date(agora.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { desde: inicioDoDia(seteDiasAtras), ate: fimDoDia(agora) };
  }
  if (preset === "mesAnterior") {
    const mesPassado = somarMeses(agora, -1);
    return { desde: inicioDoMes(mesPassado), ate: fimDoMes(mesPassado) };
  }
  // mesAtual e fallback de personalizado antes de o usuário escolher
  return { desde: inicioDoMes(agora), ate: fimDoMes(agora) };
}

interface SeletorPeriodoProps {
  valor: PeriodoSelecionado;
  onChange: (periodo: PeriodoSelecionado) => void;
  className?: string;
}

export function SeletorPeriodo({ valor, onChange, className }: SeletorPeriodoProps) {
  const selecionarPreset = (preset: PeriodoPreset) => {
    if (preset === "personalizado") {
      onChange({ preset, desde: valor.desde, ate: valor.ate });
      return;
    }
    onChange({ preset, ...periodoDoPreset(preset) });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Select value={valor.preset} onValueChange={(v) => selecionarPreset(v as PeriodoPreset)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPCOES.map((opcao) => (
            <SelectItem key={opcao.value} value={opcao.value}>
              {opcao.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {valor.preset === "personalizado" && (
        <DatePickerWithRange
          date={{ from: valor.desde, to: valor.ate }}
          onDateChange={(range) =>
            onChange({
              preset: "personalizado",
              desde: range?.from ? inicioDoDia(range.from) : valor.desde,
              ate: range?.to ? fimDoDia(range.to) : valor.ate,
            })
          }
        />
      )}
    </div>
  );
}
