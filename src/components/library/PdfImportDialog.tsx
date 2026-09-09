import { useEffect, useRef, useState } from "react";
import { loadPdfJs } from "@/lib/pdfjs-loader";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";


interface PageItem {
  page: number;
  thumb: string;
}

interface Props {
  file: File | null;
  onClose: () => void;
  /** Called with one JPEG file per selected page. */
  onImport: (files: File[], onProgress: (percent: number) => void) => Promise<void>;
}

const RENDER_SCALE = 2; // export quality

export default function PdfImportDialog({ file, onClose, onImport }: Props) {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const docRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (!file) {
      setPages([]);
      setSelected({});
      docRef.current = null;
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const buf = await file.arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        docRef.current = doc;
        const items: PageItem[] = [];
        const sel: Record<number, boolean> = {};
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 0.4 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
          if (cancelled) return;
          items.push({ page: i, thumb: canvas.toDataURL("image/jpeg", 0.7) });
          sel[i] = true;
          setPages([...items]);
        }
        setSelected(sel);
      } catch {
        toast.error("Impossible de lire ce PDF");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const selectedPages = pages.filter((p) => selected[p.page]).map((p) => p.page);

  const renderPageFile = async (pageNum: number): Promise<File> => {
    const doc = docRef.current;
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.92)
    );
    const base = (file?.name || "document.pdf").replace(/\.pdf$/i, "");
    return new File([blob], `${base}-p${pageNum}.jpg`, { type: "image/jpeg" });
  };

  const handleImport = async () => {
    if (selectedPages.length === 0) return;
    setImporting(true);
    setProgress(0);
    try {
      const files: File[] = [];
      for (const p of selectedPages) files.push(await renderPageFile(p));
      await onImport(files, setProgress);
      onClose();
    } catch {
      toast.error("Erreur lors de l'import du PDF");
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  const allSelected = pages.length > 0 && selectedPages.length === pages.length;

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o && !importing) onClose(); }}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Importer un PDF
        </DialogTitle>
        <DialogDescription>
          Choisissez les pages à ajouter à la bibliothèque. Chaque page sélectionnée devient une image.
        </DialogDescription>

        {loading && pages.length === 0 ? (
          <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lecture du PDF...
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {pages.length} page{pages.length > 1 ? "s" : ""} — {selectedPages.length} sélectionnée
                {selectedPages.length > 1 ? "s" : ""}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelected(
                    Object.fromEntries(pages.map((p) => [p.page, !allSelected]))
                  )
                }
              >
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[45vh] overflow-y-auto pr-1">
              {pages.map((p) => (
                <button
                  key={p.page}
                  type="button"
                  onClick={() => setSelected((s) => ({ ...s, [p.page]: !s[p.page] }))}
                  className={`relative rounded-md border overflow-hidden text-left transition-colors ${
                    selected[p.page] ? "border-primary ring-1 ring-primary" : "border-border"
                  }`}
                >
                  <img src={p.thumb} alt={`Page ${p.page}`} className="w-full bg-white" />
                  <div className="absolute top-1.5 left-1.5">
                    <Checkbox checked={!!selected[p.page]} className="bg-background" />
                  </div>
                  <span className="absolute bottom-1 right-1 text-[10px] bg-background/80 rounded px-1">
                    p.{p.page}
                  </span>
                </button>
              ))}
            </div>

            {importing && <Progress value={progress} className="h-2" />}
          </>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={importing}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={importing || selectedPages.length === 0}>
            {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Importer {selectedPages.length > 0 ? `(${selectedPages.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
