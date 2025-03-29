"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Barcode, X, ScanLine, CheckCircle2 } from "lucide-react";
import BarcodeReader from "./BarCodeReader";

interface BarcodeReaderButtonProps {
  onScan: (barcode: string) => void;
  buttonLabel?: string;
  dialogTitle?: string;
  buttonVariant?:
    | "default"
    | "outline"
    | "ghost"
    | "link"
    | "destructive"
    | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  validateBarcode?: (barcode: string) => boolean | Promise<boolean>;
}

const BarcodeReaderButton = ({
  onScan,
  buttonLabel = "Ler Código de Barras",
  dialogTitle = "Scanner de Código de Barras",
  buttonVariant = "default",
  size = "default",
  className = "",
  validateBarcode,
}: BarcodeReaderButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const handleBarcodeScan = (barcode: string) => {
    setLastScannedCode(barcode);
    onScan(barcode);
    // Fechar o diálogo após um breve atraso para dar feedback visual
    setTimeout(() => {
      setIsOpen(false);
      // Limpar o código escaneado após fechar
      setTimeout(() => setLastScannedCode(null), 500);
    }, 1000);
  };

  return (
    <>
      <Button
        variant={buttonVariant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 ${className}`}
      >
        <Barcode className="h-4 w-4" />
        {buttonLabel}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-900 p-0">
          <DialogHeader className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                <ScanLine className="h-5 w-5 text-indigo-500" />
                {dialogTitle}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="p-4">
            {lastScannedCode ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-500 animate-pulse" />
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Código lido com sucesso!
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 font-mono">
                    {lastScannedCode}
                  </p>
                </div>
              </div>
            ) : (
              <BarcodeReader
                onScan={handleBarcodeScan}
                scanButtonLabel="Iniciar Scanner"
                validateBarcode={validateBarcode}
                continuousMode={false}
              />
            )}
          </div>

          <DialogFooter className="border-t border-gray-200 dark:border-gray-700 p-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BarcodeReaderButton;
