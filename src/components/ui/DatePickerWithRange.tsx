"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
          className="w-auto p-0 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-lg"
          align="center"
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onDateChange({
                    from: new Date(),
                    to: new Date(),
                  })
                }
                className="text-xs border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  onDateChange({
                    from: addDays(today, -7),
                    to: today,
                  });
                }}
                className="text-xs border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                Últimos 7 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  onDateChange({
                    from: addDays(today, -30),
                    to: today,
                  });
                }}
                className="text-xs border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              >
                Últimos 30 dias
              </Button>
            </div>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            locale={ptBR}
            className="bg-white dark:bg-gray-800 p-3"
            classNames={{
              day_today:
                "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100",
              day_selected:
                "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-700 focus:text-white dark:bg-indigo-600 dark:text-white",
              day_range_middle:
                "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100",
            }}
          />
          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDateChange(undefined)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Limpar seleção
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
