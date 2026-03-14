import { useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Extract screen ID from URL like /admin/licenses?screen=UUID
            try {
              const url = new URL(decodedText);
              const screenId = url.searchParams.get("screen");
              if (screenId) {
                scanner.stop().catch(() => {});
                onScan(screenId);
                onClose();
              }
            } catch {
              // Not a valid URL, ignore
            }
          },
          () => {} // ignore scan failures
        );
      } catch (err) {
        setError("Impossible d'accéder à la caméra");
      }
    };

    // Small delay for DOM to be ready
    const timeout = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan, onClose]);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
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
          <div
            id="qr-reader"
            className="w-full rounded-lg overflow-hidden bg-muted min-h-[280px]"
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            Scannez le QR code affiché sur l'écran du player
          </p>
          <Button variant="outline" className="w-full" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
