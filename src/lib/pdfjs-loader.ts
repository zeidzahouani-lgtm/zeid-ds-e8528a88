// pdf.js est chargé à la demande depuis un CDN.
// Il n'est volontairement PAS bundlé : sa syntaxe moderne casse la
// transformation legacy (Babel) utilisée pour les vieux WebViews Android.
const PDFJS_VERSION = "6.3.289";
const BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

let pdfjsPromise: Promise<any> | null = null;

export function loadPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* @vite-ignore */ `${BASE}/build/pdf.min.mjs`).then((lib: any) => {
      lib.GlobalWorkerOptions.workerSrc = `${BASE}/build/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return pdfjsPromise;
}
