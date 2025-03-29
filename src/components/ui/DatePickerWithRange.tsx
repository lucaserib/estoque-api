"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

interface DatePickerWithRangeProps {
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
}

export function DatePickerWithRange({
  date,
  onDateChange,
  className,
}: DatePickerWithRangeProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(
    date
  );

  // Atualizar internalDate quando date mudar externamente
  React.useEffect(() => {
    setInternalDate(date);
  }, [date]);

  // Função para aplicar a seleção
  const handleApply = () => {
    onDateChange(internalDate);
  };

  // Função para limpar a seleção
  const handleClear = () => {
    setInternalDate(undefined);
    onDateChange(undefined);
  };

  // Função para selecionar período rápido
  const handleQuickSelection = (days: number) => {
    const today = new Date();
    const newRange =
      days === 0
        ? { from: today, to: today }
        : { from: addDays(today, -days + 1), to: today };

    setInternalDate(newRange);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full h-10 justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700",
              !date && "text-gray-500 dark:text-gray-400"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                  {format(date.to, "dd/MM/yyyy", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "dd/MM/yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg rounded-lg"
          align="center"
          sideOffset={4}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Selecionar período
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelection(0)}
                className="text-xs h-7 px-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelection(7)}
                className="text-xs h-7 px-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                7 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelection(30)}
                className="text-xs h-7 px-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                30 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelection(90)}
                className="text-xs h-7 px-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                90 dias
              </Button>
            </div>
          </div>

          <div className="relative">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={internalDate?.from || new Date()}
              selected={internalDate}
              onSelect={setInternalDate}
              numberOfMonths={isDesktop ? 2 : 1}
              locale={ptBR}
              className="bg-white dark:bg-gray-800 p-3 max-w-full"
              classNames={{
                day_today:
                  "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100",
                day_selected:
                  "bg-blue-600 text-white hover:bg-blue-700 hover:text-white focus:bg-blue-700 focus:text-white dark:bg-blue-600 dark:text-white",
                day_range_middle:
                  "bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100",
                months: isDesktop ? "flex space-x-4" : "space-y-4",
                caption: "flex justify-center pt-1 pb-2 relative items-center",
                caption_label: "text-sm font-medium",
                cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-blue-100 dark:[&:has([aria-selected])]:bg-blue-900/20",
                nav_button:
                  "h-7 w-7 bg-transparent p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full",
                table: "w-full border-collapse space-y-1",
              }}
            />
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {internalDate?.from && internalDate?.to && (
                <>
                  {format(internalDate.from, "dd/MM/yy", { locale: ptBR })}{" "}
                  {" a "}
                  {format(internalDate.to, "dd/MM/yy", { locale: ptBR })}
                </>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleApply}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
              disabled={!internalDate?.from || !internalDate?.to}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
