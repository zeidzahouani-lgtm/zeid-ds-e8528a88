import { useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (screenId: string) => void;
}

export default function QRScanner({ open, onClose, onScan }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const stopScanner = useCallback(() => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);

    if (!scanner || stoppingRef.current) return;
    stoppingRef.current = true;

    const safeClear = () => {
      try {
        Promise.resolve(scanner.clear()).catch(() => {});
      } catch {
        // ignore
      } finally {
        stoppingRef.current = false;
      }
    };

    try {
      scanner
        .stop()
        .catch(() => {})
        .finally(safeClear);
    } catch {
      safeClear();
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);

    // Request camera permission directly in the click handler (required by browsers)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      // Stop the stream immediately — html5-qrcode will request its own
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Accès à la caméra refusé. Vérifiez les permissions dans les réglages de votre navigateur.");
      } else {
        setError("Impossible d'accéder à la caméra.");
      }
      return;
    }

    // Small delay to ensure the DOM container is fully painted inside the dialog
    await new Promise((r) => setTimeout(r, 150));

    const readerEl = document.getElementById("qr-reader");
    if (!readerEl) {
      setError("Conteneur du scanner introuvable.");
      return;
    }

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const url = new URL(decodedText);
            const screenId = url.searchParams.get("screen");
            if (screenId) {
              stopScanner();
              onScan(screenId);
              onClose();
            }
          } catch {
            // Not a valid URL, ignore
          }
        },
        () => {}
      );
      setScanning(true);
    } catch {
      setError("Impossible d'initialiser le scanner. Réessayez.");
      scannerRef.current = null;
    }
  }, [onScan, onClose, stopScanner]);

  const handleClose = () => {
    stopScanner();
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Scanner un QR code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* The scanner injects a <video> inside this div — ensure it's visible */}
          <div
            id="qr-reader"
            className="w-full rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center"
            style={{ backgroundColor: "#000" }}
          />
          {!scanning && !error && (
            <p className="text-sm text-muted-foreground text-center">
              Appuyez sur le bouton ci-dessous pour activer la caméra
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          {!scanning ? (
            <Button className="w-full gap-2" onClick={startScanner}>
              <Camera className="h-4 w-4" />
              Activer la caméra
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Scannez le QR code affiché sur l'écran du player
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
