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
  /**
   * Callback function triggered when a barcode is successfully scanned or manually entered
   */
  onScan: (barcode: string) => void;

  /**
   * Placeholder text for the barcode input field
   */
  placeholder?: string;

  /**
   * Disables all interactivity of the component
   */
  disabled?: boolean;

  /**
   * Label for the scan button
   */
  scanButtonLabel?: string;

  /**
   * Enables or disables manual input of barcodes
   */
  allowManualInput?: boolean;

  /**
   * Shows an initial value in the input field
   */
  initialValue?: string;

  /**
   * Enable continuous scanning mode (scan multiple items without closing camera)
   */
  continuousMode?: boolean;

  /**
   * CSS class name to apply to the component
   */
  className?: string;

  /**
   * Function to check if a scanned barcode is valid
   */
  validateBarcode?: (barcode: string) => boolean | Promise<boolean>;
}

/**
 * A barcode reader component that uses the Web Barcode Detection API
 * and also allows manual barcode entry. Supports continuous scanning
 * and product validation.
 */
const BarcodeReader = ({
  onScan,
  placeholder = "Barcode...",
  disabled = false,
  scanButtonLabel = "Scan",
  allowManualInput = true,
  initialValue = "",
  continuousMode = false,
  className = "",
  validateBarcode,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Check support for Barcode Detection API
  const [isBarcodeDetectionSupported, setIsBarcodeDetectionSupported] =
    useState<boolean | null>(null);

  useEffect(() => {
    // Check if the browser supports the Barcode Detection API
    const checkBarcodeDetectionSupport = async () => {
      try {
        // @ts-ignore - The API is still experimental
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

  // Function to start the scanner
  const startScanner = async () => {
    try {
      setIsScanning(true);
      setError(null);

      // Access the camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Start detection after 1s to give time to initialize the camera
      setTimeout(() => {
        detectBarcode();
      }, 1000);
    } catch (error) {
      console.error("Error accessing camera:", error);
      setError("Could not access camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  // Function to stop the scanner
  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsScanning(false);
  };

  // Function to detect barcode in the image
  const detectBarcode = async () => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Capture video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // @ts-ignore - The API is still experimental
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

        // Validate barcode if validation function is provided
        if (validateBarcode) {
          setValidationInProgress(true);
          try {
            const isValid = await validateBarcode(detectedBarcode);
            if (!isValid) {
              // If validation fails in continuous mode, just continue scanning
              if (continuousModeActive) {
                requestAnimationFrame(detectBarcode);
                setValidationInProgress(false);
                return;
              } else {
                setError("Invalid barcode detected. Please try again.");
                stopScanner();
                setValidationInProgress(false);
                return;
              }
            }
          } catch (error) {
            console.error("Error validating barcode:", error);
            setError("Error validating barcode. Please try again.");
            stopScanner();
            setValidationInProgress(false);
            return;
          }
          setValidationInProgress(false);
        }

        // Play beep sound if enabled
        if (isSoundEnabled) {
          playBeepSound();
        }

        // Show visual feedback
        setSuccessScan(true);
        setBarcode(detectedBarcode);

        // Add to scanned items list in continuous mode
        if (continuousModeActive) {
          setScannedItems((prev) => [...prev, detectedBarcode]);
        }

        // Call callback
        onScan(detectedBarcode);

        // Stop scanner after success if not in continuous mode
        if (!continuousModeActive) {
          stopScanner();
        } else {
          // In continuous mode, reset success after 1 second and continue scanning
          setTimeout(() => {
            setSuccessScan(false);
            requestAnimationFrame(detectBarcode);
          }, 1000);
          return;
        }

        // Reset success state after a few seconds
        setTimeout(() => {
          setSuccessScan(false);
        }, 2000);

        return;
      }

      // If no code found, continue trying
      if (isScanning && streamRef.current) {
        requestAnimationFrame(detectBarcode);
      }
    } catch (error) {
      console.error("Error detecting barcode:", error);
      setError("Error processing image. Please try again.");
      stopScanner();
    }
  };

  // Play beep sound
  const playBeepSound = () => {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
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

  // Clean up resources when unmounting
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Handle manual submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode && barcode.trim() !== "") {
      // Validate barcode if validation function is provided
      if (validateBarcode) {
        setValidationInProgress(true);
        try {
          const isValid = await validateBarcode(barcode);
          if (!isValid) {
            setError("Invalid barcode entered. Please try again.");
            setValidationInProgress(false);
            return;
          }
        } catch (error) {
          console.error("Error validating barcode:", error);
          setError("Error validating barcode. Please try again.");
          setValidationInProgress(false);
          return;
        }
        setValidationInProgress(false);
      }

      onScan(barcode);
      setSuccessScan(true);

      // Add to scanned items list in continuous mode
      if (continuousModeActive) {
        setScannedItems((prev) => [...prev, barcode]);
        setBarcode(""); // Clear input for next scan
      }

      setTimeout(() => {
        setSuccessScan(false);
      }, 2000);
    }
  };

  // Clear scanned items list
  const clearScannedItems = () => {
    setScannedItems([]);
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Video scanner (visible only when scanning) */}
      {isScanning && (
        <div className="relative w-full max-w-md mx-auto aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative w-4/5 h-1/3 border-2 border-white border-opacity-60 rounded-lg">
              <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-scan"></div>
            </div>
            <p className="text-white mt-2 font-medium">
              Position barcode in frame
            </p>
          </div>

          {/* Button to cancel scanning */}
          <Button
            variant="secondary"
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-6"
            onClick={stopScanner}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Barcode input */}
      <form onSubmit={handleManualSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Barcode className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Barcode / EAN
            </span>

            {/* Success indicator */}
            {successScan && (
              <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Scan successful
              </Badge>
            )}

            {validationInProgress && (
              <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Validating...
              </Badge>
            )}
          </div>

          <div className="relative">
            <Input
              type="text"
              placeholder={placeholder}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={
                disabled ||
                isScanning ||
                !allowManualInput ||
                validationInProgress
              }
              className={
                successScan ? "border-green-500 focus:ring-green-500" : ""
              }
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                className="h-7 w-7 p-0 rounded-full"
              >
                {isSoundEnabled ? (
                  <Volume2 className="h-4 w-4 text-gray-500" />
                ) : (
                  <VolumeX className="h-4 w-4 text-gray-500" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {allowManualInput && (
          <Button
            type="submit"
            disabled={
              disabled || isScanning || !barcode.trim() || validationInProgress
            }
            className="dark:bg-green-700 dark:hover:bg-green-600"
          >
            {validationInProgress ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirm
          </Button>
        )}

        {isBarcodeDetectionSupported && (
          <Button
            type="button"
            onClick={startScanner}
            disabled={disabled || isScanning || validationInProgress}
            variant="secondary"
            className="flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning...
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
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Seu navegador não suporta o scanner do código de barras, por favor
          insira manualmente ou conecte um aparelho de conferência.
        </p>
      )}

      {/* Continuous mode items list */}
      {continuousModeActive && scannedItems.length > 0 && (
        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
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
                className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded text-sm"
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
