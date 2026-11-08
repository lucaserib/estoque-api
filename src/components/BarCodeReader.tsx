"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Barcode,
  CheckCircle2,
  Loader2,
  Scan,
  Volume2,
  VolumeX,
  Package,
  AlertTriangle,
} from "lucide-react";

interface BarcodeReaderProps {
  onScan: (barcode: string) => void;

  placeholder?: string;

  disabled?: boolean;

  scanButtonLabel?: string;

  allowManualInput?: boolean;

  initialValue?: string;

  continuousMode?: boolean;

  className?: string;

  validateBarcode?: (barcode: string) => boolean | Promise<boolean>;

  maxLength?: number;
}

const BarcodeReader = ({
  onScan,
  placeholder = "EAN-13...",
  disabled = false,
  scanButtonLabel = "Scan",
  allowManualInput = true,
  initialValue = "",
  continuousMode = false,
  className = "",
  validateBarcode,
  maxLength = 13,
}: BarcodeReaderProps) => {
  const [barcode, setBarcode] = useState<string>(initialValue);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successScan, setSuccessScan] = useState<boolean>(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [validationInProgress, setValidationInProgress] =
    useState<boolean>(false);
  const [continuousModeActive, setContinuousModeActive] =
    useState<boolean>(continuousMode);
  const [scannedItems, setScannedItems] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isBarcodeDetectionSupported, setIsBarcodeDetectionSupported] =
    useState<boolean | null>(null);

  useEffect(() => {
    const checkBarcodeDetectionSupport = async () => {
      try {
        if ("BarcodeDetector" in window) {
          setIsBarcodeDetectionSupported(true);
        } else {
          setIsBarcodeDetectionSupported(false);
          console.log(
            "Barcode Detection API is not supported in this browser."
          );
        }
      } catch (error) {
        setIsBarcodeDetectionSupported(false);
        console.error("Error checking support:", error);
      }
    };

    checkBarcodeDetectionSupport();
  }, []);

  const validateEAN13 = (code: string): boolean => {
    if (code.length !== 13) return false;
    if (!/^\d+$/.test(code)) return false;

    const digits = code.split("").map(Number);
    const checkDigit = digits[12];
    const sum = digits.slice(0, 12).reduce((acc, digit, index) => {
      return acc + (index % 2 === 0 ? digit : digit * 3);
    }, 0);
    const calculatedCheckDigit = (10 - (sum % 10)) % 10;

    return checkDigit === calculatedCheckDigit;
  };

  const startScanner = async () => {
    try {
      setIsScanning(true);
      setError(null);
      setCameraError(null);

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch (backCameraError) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setTimeout(() => {
        detectBarcode();
      }, 1000);
    } catch (error) {
      console.error("Erro ao acessar câmera:", error);
      setCameraError(
        "Não foi possível acessar a câmera. Verifique as permissões."
      );
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsScanning(false);
  };

  const detectBarcode = async () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      //@ts-expect-error - The API is still experimental
      const barcodeDetector = new BarcodeDetector({
        formats: [
          "ean_13",
          "ean_8",
          "code_39",
          "code_128",
          "qr_code",
          "pdf417",
          "data_matrix",
          "upc_a",
          "upc_e",
          "itf",
        ],
      });

      const barcodes = await barcodeDetector.detect(canvas);

      if (barcodes.length > 0) {
        const detectedBarcode = barcodes[0].rawValue;

        if (!validateEAN13(detectedBarcode)) {
          if (continuousModeActive) {
            requestAnimationFrame(detectBarcode);
            return;
          } else {
            setError("Código de barras inválido. Use um EAN-13 válido.");
            stopScanner();
            return;
          }
        }

        if (validateBarcode) {
          setValidationInProgress(true);
          try {
            const isValid = await validateBarcode(detectedBarcode);
            if (!isValid) {
              if (continuousModeActive) {
                requestAnimationFrame(detectBarcode);
                setValidationInProgress(false);
                return;
              } else {
                setError("Código de barras inválido. Tente novamente.");
                stopScanner();
                setValidationInProgress(false);
                return;
              }
            }
          } catch (error) {
            console.error("Erro ao validar código de barras:", error);
            setError("Erro ao validar código de barras. Tente novamente.");
            stopScanner();
            setValidationInProgress(false);
            return;
          }
          setValidationInProgress(false);
        }

        if (isSoundEnabled) {
          playBeepSound();
        }

        setSuccessScan(true);
        setBarcode(detectedBarcode);

        if (continuousModeActive) {
          setScannedItems((prev) => [...prev, detectedBarcode]);
        }

        onScan(detectedBarcode);

        if (!continuousModeActive) {
          stopScanner();
        } else {
          setTimeout(() => {
            setSuccessScan(false);
            requestAnimationFrame(detectBarcode);
          }, 1000);
          return;
        }

        setTimeout(() => {
          setSuccessScan(false);
        }, 2000);

        return;
      }

      if (isScanning && streamRef.current) {
        requestAnimationFrame(detectBarcode);
      }
    } catch (error) {
      console.error("Error detecting barcode:", error);
      setError("Error processing image. Please try again.");
      stopScanner();
    }
  };

  const playBeepSound = () => {
    const AudioContextClass: typeof AudioContext =
      window.AudioContext ||
      // @ts-expect-error - Suporte a Safari e navegadores mais antigos
      window.webkitAudioContext;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.1;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, 100);
  };
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const manterFocoNoCampo = () => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 10);
  };

  useEffect(() => {
    manterFocoNoCampo();
  }, []);

  const evitarPerdaDeFoco = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode && barcode.trim() !== "") {
      if (!validateEAN13(barcode)) {
        setError("Código de barras inválido. Use um EAN-13 válido.");
        manterFocoNoCampo();
        return;
      }

      if (validateBarcode) {
        setValidationInProgress(true);
        try {
          const isValid = await validateBarcode(barcode);
          if (!isValid) {
            setError("Código de barras inválido. Tente novamente.");
            setValidationInProgress(false);
            manterFocoNoCampo();
            return;
          }
        } catch (error) {
          console.error("Erro ao validar código de barras:", error);
          setError("Erro ao validar código de barras. Tente novamente.");
          setValidationInProgress(false);
          manterFocoNoCampo();
          return;
        }
        setValidationInProgress(false);
      }

      onScan(barcode);
      setSuccessScan(true);

      if (continuousModeActive) {
        setScannedItems((prev) => [...prev, barcode]);
        setBarcode("");

        manterFocoNoCampo();
      } else {
        setBarcode("");
        manterFocoNoCampo();
      }

      setTimeout(() => {
        setSuccessScan(false);
      }, 2000);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Enter" &&
      barcode &&
      barcode.trim() !== "" &&
      !disabled &&
      !isScanning &&
      allowManualInput &&
      !validationInProgress
    ) {
      e.preventDefault();
      if (!validateEAN13(barcode)) {
        setError("Código de barras inválido. Use um EAN-13 válido.");
        manterFocoNoCampo();
        return;
      }

      if (validateBarcode) {
        setValidationInProgress(true);
        try {
          const isValid = await validateBarcode(barcode);
          if (!isValid) {
            setError("Código de barras inválido. Tente novamente.");
            setValidationInProgress(false);
            manterFocoNoCampo();
            return;
          }
        } catch (error) {
          console.error("Erro ao validar código de barras:", error);
          setError("Erro ao validar código de barras. Tente novamente.");
          setValidationInProgress(false);
          manterFocoNoCampo();
          return;
        }
        setValidationInProgress(false);
      }

      if (isSoundEnabled) {
        playBeepSound();
      }

      onScan(barcode);
      setSuccessScan(true);

      if (continuousModeActive) {
        setScannedItems((prev) => [...prev, barcode]);
        setBarcode("");

        manterFocoNoCampo();
      } else {
        setBarcode("");
        manterFocoNoCampo();
      }

      setTimeout(() => {
        setSuccessScan(false);
      }, 2000);
    }
  };

  const clearScannedItems = () => {
    setScannedItems([]);
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {isScanning && (
        <div className="relative w-full max-w-md mx-auto aspect-[4/3] bg-muted rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            autoFocus
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative w-4/5 h-1/3 border-2 border-white border-opacity-60 rounded-lg">
              <div className="absolute top-0 left-0 w-full h-1 bg-success animate-scan"></div>
            </div>
            <p className="text-white mt-2 font-medium">
              Posicione o código de barras no quadro
            </p>
          </div>

          <Button
            variant="secondary"
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6"
            onClick={stopScanner}
          >
            Cancelar
          </Button>
        </div>
      )}

      {(error || cameraError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error || cameraError}</AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={handleManualSubmit}
        className="flex flex-col sm:flex-row gap-2"
        onClick={evitarPerdaDeFoco}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Barcode className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              EAN-13
            </span>

            {successScan && (
              <Badge className="ml-2 bg-success/10 text-success-text">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Scan bem-sucedido
              </Badge>
            )}

            {validationInProgress && (
              <Badge className="ml-2 bg-warning/10 text-warning-text">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Validando...
              </Badge>
            )}
          </div>

          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={barcode}
              onChange={(e) => {
                const value = e.target.value
                  .replace(/\D/g, "")
                  .slice(0, maxLength);
                setBarcode(value);
              }}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              pattern="[0-9]*"
              inputMode="numeric"
              disabled={
                disabled ||
                isScanning ||
                !allowManualInput ||
                validationInProgress
              }
              className={
                successScan ? "border-success focus:ring-success" : ""
              }
              autoFocus
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSoundEnabled(!isSoundEnabled);
                  manterFocoNoCampo();
                }}
                className="h-7 w-7 p-0 rounded-full"
              >
                {isSoundEnabled ? (
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {allowManualInput && (
          <Button
            type="submit"
            disabled={
              disabled ||
              isScanning ||
              !barcode.trim() ||
              validationInProgress ||
              barcode.length !== 13
            }
            className="bg-success hover:bg-success/90 text-success-foreground"
            onClick={(e) => {
              e.preventDefault();
              handleManualSubmit(e);
            }}
          >
            {validationInProgress ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirmar
          </Button>
        )}

        {isBarcodeDetectionSupported && (
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              startScanner();
            }}
            disabled={disabled || isScanning || validationInProgress}
            variant="secondary"
            className="flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Escaneando...
              </>
            ) : (
              <>
                <Scan className="h-4 w-4" />
                {scanButtonLabel}
              </>
            )}
          </Button>
        )}
      </form>

      {isBarcodeDetectionSupported === false && (
        <p className="text-sm text-warning-text">
          Seu navegador não suporta o scanner do código de barras, por favor
          insira manualmente ou conecte um aparelho de conferência.
        </p>
      )}

      {continuousModeActive && scannedItems.length > 0 && (
        <div className="mt-4 border border-border rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Scanned Items ({scannedItems.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={clearScannedItems}
              className="h-7 text-xs"
            >
              Clear All
            </Button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {scannedItems.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="flex justify-between items-center py-2 px-3 bg-background rounded text-sm"
              >
                <span className="font-medium">{item}</span>
                <Badge>Item {index + 1}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0;
          }
        }

        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default BarcodeReader;
