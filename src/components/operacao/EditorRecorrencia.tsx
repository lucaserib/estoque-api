"use client";

import { cn } from "@/lib/utils";
import { NOMES_DIAS_SEMANA, type Recorrencia } from "@/modules/operacao/dominio/recorrencia";

const campo = "h-10 rounded-lg border border-input bg-background px-2.5 text-sm disabled:opacity-60";

export function EditorRecorrencia({
  valor,
  aoMudar,
  diaDoPrazo,
  desabilitado,
}: {
  valor: Recorrencia | null;
  aoMudar: (valor: Recorrencia | null) => void;
  diaDoPrazo: string | null;
  desabilitado?: boolean;
}) {
  const diaSemanaDoPrazo = diaDoPrazo ? new Date(`${diaDoPrazo}T12:00:00Z`).getUTCDay() : 1;
  const diaDoMes = diaDoPrazo ? Number(diaDoPrazo.slice(8, 10)) : 1;

  const mudarFrequencia = (frequencia: string) => {
    if (!frequencia) return aoMudar(null);
    aoMudar({
      frequencia: frequencia as Recorrencia["frequencia"],
      intervalo: valor?.intervalo ?? 1,
      diasSemana: frequencia === "SEMANAL" ? (valor?.diasSemana.length ? valor.diasSemana : [diaSemanaDoPrazo]) : [],
      diaDoMes: frequencia === "MENSAL" ? valor?.diaDoMes ?? diaDoMes : null,
      ate: valor?.ate ?? null,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Repetir"
          value={valor?.frequencia ?? ""}
          onChange={(e) => mudarFrequencia(e.target.value)}
          disabled={desabilitado || !diaDoPrazo}
          className={cn(campo, "min-w-[140px]")}
        >
          <option value="">Não repete</option>
          <option value="DIARIA">Todo dia</option>
          <option value="SEMANAL">Toda semana</option>
          <option value="MENSAL">Todo mês</option>
        </select>
        {valor && (
          <label className="flex items-center gap-1.5 text-sm text-fg2">
            a cada
            <input
              type="number"
              min={1}
              max={30}
              value={valor.intervalo}
              onChange={(e) => aoMudar({ ...valor, intervalo: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
              disabled={desabilitado}
              aria-label="Intervalo"
              className={cn(campo, "w-16")}
            />
            {valor.frequencia === "DIARIA" ? "dia(s)" : valor.frequencia === "SEMANAL" ? "semana(s)" : "mês(es)"}
          </label>
        )}
      </div>
      {!diaDoPrazo && <p className="text-xs text-muted-foreground">Defina um prazo para poder repetir a tarefa.</p>}
      {valor?.frequencia === "SEMANAL" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
          {NOMES_DIAS_SEMANA.map((nome, dia) => {
            const marcado = valor.diasSemana.includes(dia);
            return (
              <button
                key={nome}
                type="button"
                aria-pressed={marcado}
                disabled={desabilitado || (marcado && valor.diasSemana.length === 1)}
                onClick={() =>
                  aoMudar({
                    ...valor,
                    diasSemana: marcado ? valor.diasSemana.filter((d) => d !== dia) : [...valor.diasSemana, dia].sort((a, b) => a - b),
                  })
                }
                className={cn(
                  "h-10 w-11 rounded-lg border text-xs font-medium capitalize",
                  marcado ? "border-primary bg-primary/10 text-primary" : "border-border text-fg2"
                )}
              >
                {nome}
              </button>
            );
          })}
        </div>
      )}
      {valor?.frequencia === "MENSAL" && (
        <label className="flex items-center gap-1.5 text-sm text-fg2">
          no dia
          <input
            type="number"
            min={1}
            max={31}
            value={valor.diaDoMes ?? diaDoMes}
            onChange={(e) => aoMudar({ ...valor, diaDoMes: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
            disabled={desabilitado}
            aria-label="Dia do mês"
            className={cn(campo, "w-16")}
          />
        </label>
      )}
      {valor && (
        <label className="flex flex-wrap items-center gap-1.5 text-sm text-fg2">
          até
          <input
            type="date"
            value={valor.ate ?? ""}
            onChange={(e) => aoMudar({ ...valor, ate: e.target.value || null })}
            disabled={desabilitado}
            aria-label="Repetir até"
            className={campo}
          />
          <span className="text-xs text-muted-foreground">(vazio = sem fim)</span>
        </label>
      )}
    </div>
  );
}
