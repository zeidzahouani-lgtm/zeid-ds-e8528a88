import { useState, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Lock, CheckCircle, Loader2, Image as ImageIcon, Clock, CalendarDays, RotateCw, Video, Maximize2, Move, Grid3x3, LayoutGrid, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function toLocalDatetime(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

type FitMode = "cover" | "contain" | "fill";
type SizeMode = "full" | "half" | "quarter";
type Position =
  | "top-left" | "top" | "top-right"
  | "left" | "center" | "right"
  | "bottom-left" | "bottom" | "bottom-right";

const POSITIONS: Position[] = [
  "top-left", "top", "top-right",
  "left", "center", "right",
  "bottom-left", "bottom", "bottom-right",
];

function sizePercent(size: SizeMode) {
  if (size === "full") return 100;
  if (size === "half") return 50;
  return 25;
}

function positionStyle(pos: Position): React.CSSProperties {
  const [v, h] = (() => {
    const map: Record<string, [string, string]> = {
      "top-left": ["top", "left"], "top": ["top", "center"], "top-right": ["top", "right"],
      "left": ["center", "left"], "center": ["center", "center"], "right": ["center", "right"],
      "bottom-left": ["bottom", "left"], "bottom": ["bottom", "center"], "bottom-right": ["bottom", "right"],
    };
    return map[pos];
  })();
  const style: React.CSSProperties = { position: "absolute" };
  if (v === "top") style.top = 0;
  else if (v === "bottom") style.bottom = 0;
  else { style.top = "50%"; style.transform = (style.transform || "") + " translateY(-50%)"; }
  if (h === "left") style.left = 0;
  else if (h === "right") style.right = 0;
  else { style.left = "50%"; style.transform = (style.transform || "") + " translateX(-50%)"; }
  return style;
}

export default function UploadPage() {
  const { id: screenId } = useParams<{ id: string }>();
  const [step, setStep] = useState<"code" | "upload" | "done">("code");
  const [code, setCode] = useState("");
  const [userName, setUserName] = useState("");
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const defaultStart = toLocalDatetime(now);
  const defaultEnd = toLocalDatetime(new Date(now.getTime() + 60 * 60 * 1000));
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [duration, setDuration] = useState("60");
  const [orientation, setOrientation] = useState("landscape");

  // Nouveaux paramètres de rendu (mode simple)
  const [fit, setFit] = useState<FitMode>("cover");
  const [size, setSize] = useState<SizeMode>("full");
  const [position, setPosition] = useState<Position>("center");

  // Mode multi-fichiers en grille
  const [mode, setMode] = useState<"single" | "grid">("single");
  type GridPreset = "1x2" | "2x1" | "2x2" | "3x3";
  const [gridPreset, setGridPreset] = useState<GridPreset>("2x2");
  const gridDims = useMemo<{ rows: number; cols: number }>(() => {
    const [r, c] = gridPreset.split("x").map(Number);
    return { rows: r, cols: c };
  }, [gridPreset]);
  const gridCount = gridDims.rows * gridDims.cols;
  type Slot = {
    file: File | null;
    preview: string | null;
    // per-cell rendering + playback overrides
    fit?: FitMode;      // image/video adaptation
    muted?: boolean;    // video only
    loop?: boolean;     // video only
    autoplay?: boolean; // video only (default true)
  };
  const defaultFitFor = (isVid: boolean): FitMode => (isVid ? "contain" : "cover");
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: 4 }, () => ({ file: null, preview: null })));
  const [gridFit, setGridFit] = useState<FitMode>("cover"); // fallback global (nouveaux fichiers)
  const gridInputRef = useRef<HTMLInputElement>(null);

  // Ajuster le nombre de slots quand la grille change
  const setPreset = (preset: GridPreset) => {
    const [r, c] = preset.split("x").map(Number);
    const n = r * c;
    setGridPreset(preset);
    setSlots(prev => {
      const next = Array.from({ length: n }, (_, i) => prev[i] || { file: null, preview: null });
      return next;
    });
  };

  const autoPlaceFiles = (files: File[]) => {
    setSlots(prev => {
      const next = prev.slice(0, gridCount);
      while (next.length < gridCount) next.push({ file: null, preview: null });
      let idx = 0;
      for (const f of files) {
        // trouver le prochain slot vide
        while (idx < next.length && next[idx].file) idx++;
        if (idx >= next.length) break;
        const isImage = f.type.startsWith("image/");
        const isVideo = f.type.startsWith("video/");
        if (!isImage && !isVideo) continue;
        next[idx] = {
          file: f,
          preview: URL.createObjectURL(f),
          fit: defaultFitFor(isVideo),
          muted: true,
          loop: true,
          autoplay: true,
        };
        idx++;
      }
      return next;
    });
  };

  const clearSlot = (i: number) => {
    setSlots(prev => prev.map((s, k) => (k === i ? { file: null, preview: null } : s)));
  };

  const updateSlot = (i: number, patch: Partial<Slot>) => {
    setSlots(prev => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  };

  const swapSlots = (a: number, b: number) => {
    setSlots(prev => {
      const next = prev.slice();
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    try {
      const { data, error } = await (supabase.rpc as any)("validate_access_code_for_screen", {
        _code: code.trim().toUpperCase(),
        _screen_id: screenId,
      });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        toast.error("Code invalide, désactivé ou non autorisé sur cet écran");
      } else {
        setUserName(row.user_name);
        setStep("upload");
        toast.success(`Bienvenue ${row.user_name} !`);
      }
    } catch {
      toast.error("Erreur de vérification");
    } finally {
      setChecking(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isImage = f.type.startsWith("image/");
    const isVideo = f.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast.error("Seules les images et vidéos sont acceptées");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const isVideo = file?.type.startsWith("video/") ?? false;
  const isPortrait = orientation === "portrait" || orientation === "portrait-flipped";

  const handleDurationChange = (val: string) => {
    setDuration(val);
    if (val !== "custom") {
      const mins = parseInt(val);
      const start = new Date(startTime);
      const end = new Date(start.getTime() + mins * 60 * 1000);
      setEndTime(toLocalDatetime(end));
    }
  };

  const handleStartChange = (val: string) => {
    setStartTime(val);
    if (duration !== "custom") {
      const mins = parseInt(duration);
      const start = new Date(val);
      const end = new Date(start.getTime() + mins * 60 * 1000);
      setEndTime(toLocalDatetime(end));
    }
  };

  const previewInnerStyle = useMemo<React.CSSProperties>(() => {
    const pct = sizePercent(size);
    return {
      width: `${pct}%`,
      height: `${pct}%`,
      ...positionStyle(position),
      overflow: "hidden",
      backgroundColor: "#000",
    };
  }, [size, position]);

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: fit as any,
    objectPosition: "center center",
    display: "block",
  };

  const handleUpload = async () => {
    if (!file || !screenId) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const filePath = `screen-${screenId}/${Date.now()}_${userName.replace(/\s+/g, "_")}.${ext}`;

      const bucketUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/uploads/${filePath}`;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", bucketUrl, true);
        xhr.setRequestHeader("apikey", apiKey);
        xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
      });

      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("URL introuvable");

      const start = new Date(startTime);
      const end = new Date(endTime);
      if (end <= start) {
        toast.error("La date de fin doit être après la date de début");
        setUploading(false);
        return;
      }

      const { error: contentError } = await (supabase.from("contents") as any).insert({
        image_url: publicUrl,
        title: `Upload de ${userName}`,
        status: "active",
        source: "qr_upload",
        screen_id: screenId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        sender_email: null,
        metadata: { orientation, type: isVideo ? "video" : "image", fit, size, position },
      });
      if (contentError) throw contentError;

      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.round(diffMs / 60000);
      const label = diffMins >= 60 ? `${Math.round(diffMins / 60)}h${diffMins % 60 > 0 ? diffMins % 60 + "min" : ""}` : `${diffMins} minutes`;

      setStep("done");
      toast.success(`${isVideo ? "Vidéo" : "Image"} envoyée ! Diffusion pendant ${label}.`);
    } catch (err: any) {
      toast.error("Erreur: " + (err.message || "Upload échoué"));
    } finally {
      setUploading(false);
    }
  };

  const uploadOne = (f: File, path: string, onProg?: (p: number) => void) => {
    const bucketUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/uploads/${path}`;
    const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", bucketUrl, true);
      xhr.setRequestHeader("apikey", apiKey);
      xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProg) onProg(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(f);
    });
  };

  const handleGridUpload = async () => {
    if (!screenId) return;
    const filled = slots.slice(0, gridCount).map((s, i) => ({ ...s, idx: i })).filter(s => !!s.file);
    if (filled.length < 2) {
      toast.error("Sélectionnez au moins 2 fichiers pour la grille");
      return;
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      toast.error("La date de fin doit être après la date de début");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const batch_id = (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let done = 0;
      for (const s of filled) {
        const f = s.file as File;
        const isVid = f.type.startsWith("video/");
        const ext = f.name.split(".").pop() || (isVid ? "mp4" : "jpg");
        const path = `screen-${screenId}/${Date.now()}_${s.idx}_${userName.replace(/\s+/g, "_")}.${ext}`;
        await uploadOne(f, path, (p) => {
          const overall = Math.round(((done + p / 100) / filled.length) * 100);
          setUploadProgress(overall);
        });
        done++;
        setUploadProgress(Math.round((done / filled.length) * 100));

        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) throw new Error("URL introuvable");

        const { error: contentError } = await (supabase.from("contents") as any).insert({
          image_url: publicUrl,
          title: `Grille ${gridPreset} de ${userName} (${s.idx + 1})`,
          status: "active",
          source: "qr_upload",
          screen_id: screenId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          sender_email: null,
          metadata: {
            orientation,
            type: isVid ? "video" : "image",
            fit: s.fit || defaultFitFor(isVid),
            batch_id,
            grid: { rows: gridDims.rows, cols: gridDims.cols },
            cell: s.idx,
            ...(isVid ? {
              muted: s.muted !== false,
              loop: s.loop !== false,
              autoplay: s.autoplay !== false,
            } : {}),
          },
        });
        if (contentError) throw contentError;
      }
      setStep("done");
      toast.success(`Grille ${gridPreset} envoyée (${filled.length} médias) !`);
    } catch (err: any) {
      toast.error("Erreur: " + (err.message || "Upload échoué"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className={`w-full ${mode === "grid" && step === "upload" ? "max-w-2xl" : "max-w-md"}`}>

        {step === "code" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Accès à l'écran</CardTitle>
              <CardDescription>Entrez votre code d'accès pour diffuser du contenu</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Code d'accès</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Entrez votre code"
                    className="text-center text-lg font-mono tracking-widest"
                    autoFocus
                    maxLength={20}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={checking || !code.trim()}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {checking ? "Vérification..." : "Valider"}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === "upload" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Envoyer du contenu</CardTitle>
              <CardDescription>Bonjour {userName} ! Un seul média ou plusieurs en grille.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "grid")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Un seul média</TabsTrigger>
                  <TabsTrigger value="grid" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Grille multi</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="space-y-4 mt-4">

              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
              {preview ? (
                <div className="relative group">
                  {isVideo ? (
                    <video src={preview} className="w-full h-40 object-cover rounded-lg border border-border" muted playsInline />
                  ) : (
                    <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-lg border border-border" />
                  )}
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                  >
                    <span className="text-white text-sm font-medium">Changer le fichier</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex gap-2">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Cliquez pour sélectionner une image ou vidéo</span>
                </button>
              )}

              {/* Orientation */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <RotateCw className="h-3.5 w-3.5" /> Orientation
                </Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Paysage (0°)</SelectItem>
                    <SelectItem value="portrait">Portrait (90°)</SelectItem>
                    <SelectItem value="landscape-flipped">Paysage inversé (180°)</SelectItem>
                    <SelectItem value="portrait-flipped">Portrait inversé (270°)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fit + Size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Maximize2 className="h-3.5 w-3.5" /> Affichage
                  </Label>
                  <Select value={fit} onValueChange={(v) => setFit(v as FitMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cover">Remplir (rogne)</SelectItem>
                      <SelectItem value="contain">Contenir (bandes)</SelectItem>
                      <SelectItem value="fill">Étirer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Maximize2 className="h-3.5 w-3.5" /> Taille
                  </Label>
                  <Select value={size} onValueChange={(v) => setSize(v as SizeMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Plein écran (100%)</SelectItem>
                      <SelectItem value="half">Moitié (50%)</SelectItem>
                      <SelectItem value="quarter">Quart (25%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Position grid */}
              {size !== "full" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Move className="h-3.5 w-3.5" /> Position
                  </Label>
                  <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg border border-border bg-muted/30">
                    {POSITIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPosition(p)}
                        className={`aspect-square rounded-md border transition-all ${
                          position === p
                            ? "bg-primary border-primary shadow-sm scale-95"
                            : "bg-background border-border hover:border-primary/50"
                        }`}
                        aria-label={p}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Live preview */}
              {preview && (
                <div className="space-y-2">
                  <Label className="text-sm">Aperçu du rendu</Label>
                  <div
                    className="relative mx-auto rounded-lg overflow-hidden border-2 border-border bg-black shadow-inner"
                    style={{
                      width: "100%",
                      aspectRatio: isPortrait ? "9 / 16" : "16 / 9",
                      maxHeight: 220,
                    }}
                  >
                    <div style={previewInnerStyle}>
                      {isVideo ? (
                        <video src={preview} style={mediaStyle} muted playsInline autoPlay loop />
                      ) : (
                        <img src={preview} alt="" style={mediaStyle} />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Reproduit fidèlement l'écran cible ({isPortrait ? "portrait" : "paysage"})
                  </p>
                </div>
              )}

              {/* Duration */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm">
                  <CalendarDays className="h-3.5 w-3.5" /> Durée de diffusion
                </Label>
                <Select value={duration} onValueChange={handleDurationChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 heure</SelectItem>
                    <SelectItem value="120">2 heures</SelectItem>
                    <SelectItem value="480">8 heures (journée)</SelectItem>
                    <SelectItem value="1440">24 heures</SelectItem>
                    <SelectItem value="custom">Personnalisé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3 w-3" /> Début</Label>
                  <Input type="datetime-local" value={startTime} onChange={e => handleStartChange(e.target.value)} className="text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3 w-3" /> Fin</Label>
                  <Input type="datetime-local" value={endTime} onChange={e => { setEndTime(e.target.value); setDuration("custom"); }} className="text-xs" />
                </div>
              </div>

              {uploading && mode === "single" && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Upload en cours…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <Button onClick={handleUpload} className="w-full gap-2" disabled={!file || uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? `Envoi ${uploadProgress}%` : `Diffuser ${isVideo ? "la vidéo" : "l'image"}`}
              </Button>
                </TabsContent>

                <TabsContent value="grid" className="space-y-4 mt-4">
                  <input
                    ref={gridInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) autoPlaceFiles(files);
                      if (gridInputRef.current) gridInputRef.current.value = "";
                    }}
                    className="hidden"
                  />

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm">
                      <Grid3x3 className="h-3.5 w-3.5" /> Disposition
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {(["1x2","2x1","2x2","3x3"] as GridPreset[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPreset(p)}
                          className={`px-2 py-2 rounded-md border text-xs font-medium transition ${
                            gridPreset === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Cellules ({slots.slice(0, gridCount).filter(s => s.file).length}/{gridCount})</Label>
                      <Button size="sm" variant="outline" onClick={() => gridInputRef.current?.click()} className="gap-1 h-7">
                        <Plus className="h-3 w-3" /> Ajouter des fichiers
                      </Button>
                    </div>
                    <div
                      className="grid gap-2 p-2 rounded-lg border border-border bg-muted/30 mx-auto"
                      style={{
                        gridTemplateRows: `repeat(${gridDims.rows}, 1fr)`,
                        gridTemplateColumns: `repeat(${gridDims.cols}, 1fr)`,
                        aspectRatio: isPortrait ? "9 / 16" : "16 / 9",
                        maxHeight: 280,
                        width: "100%",
                      }}
                    >
                      {Array.from({ length: gridCount }).map((_, i) => {
                        const s = slots[i];
                        const filled = !!s?.file;
                        const isVid = s?.file?.type.startsWith("video/");
                        const cellFit = s?.fit || defaultFitFor(!!isVid);
                        const cycleFit = () => {
                          const order: FitMode[] = ["cover", "contain", "fill"];
                          const next = order[(order.indexOf(cellFit) + 1) % order.length];
                          updateSlot(i, { fit: next });
                        };
                        const fitLabel = cellFit === "cover" ? "Remplir" : cellFit === "contain" ? "Contenir" : "Étirer";
                        return (
                          <div
                            key={i}
                            className="relative rounded-md border border-border overflow-hidden bg-background"
                          >
                            {filled ? (
                              <>
                                {isVid ? (
                                  <video
                                    src={s.preview!}
                                    className="w-full h-full"
                                    style={{ objectFit: cellFit as any }}
                                    muted={s.muted !== false}
                                    playsInline
                                    autoPlay={s.autoplay !== false}
                                    loop={s.loop !== false}
                                  />
                                ) : (
                                  <img src={s.preview!} alt="" className="w-full h-full" style={{ objectFit: cellFit as any }} />
                                )}
                                <div className="absolute top-1 left-1 flex items-center gap-1">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">{i + 1}</span>
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-primary/80 text-primary-foreground uppercase">{isVid ? "vidéo" : "image"}</span>
                                </div>
                                <button
                                  onClick={() => clearSlot(i)}
                                  className="absolute top-1 right-1 h-5 w-5 rounded bg-black/70 text-white flex items-center justify-center hover:bg-red-600"
                                  aria-label="Retirer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                                {/* Per-cell fit toggle */}
                                <button
                                  onClick={cycleFit}
                                  title="Adaptation de la cellule (Remplir / Contenir / Étirer)"
                                  className="absolute top-7 right-1 h-5 px-1.5 rounded bg-black/70 text-white text-[9px] hover:bg-primary"
                                >
                                  {fitLabel}
                                </button>
                                {/* Per-cell video toggles */}
                                {isVid && (
                                  <div className="absolute top-[52px] right-1 flex flex-col gap-1">
                                    <button
                                      onClick={() => updateSlot(i, { muted: !(s.muted !== false) })}
                                      title="Son de la vidéo"
                                      className={`h-5 px-1.5 rounded text-[9px] ${s.muted !== false ? "bg-black/70 text-white" : "bg-primary text-primary-foreground"}`}
                                    >
                                      {s.muted !== false ? "🔇" : "🔊"}
                                    </button>
                                    <button
                                      onClick={() => updateSlot(i, { loop: !(s.loop !== false) })}
                                      title="Lecture en boucle"
                                      className={`h-5 px-1.5 rounded text-[9px] ${s.loop !== false ? "bg-primary text-primary-foreground" : "bg-black/70 text-white"}`}
                                    >
                                      ↻
                                    </button>
                                  </div>
                                )}
                                {i > 0 && (
                                  <button
                                    onClick={() => swapSlots(i, i - 1)}
                                    className="absolute bottom-1 left-1 h-5 px-1.5 rounded bg-black/60 text-white text-[10px] hover:bg-black/80"
                                  >←</button>
                                )}
                                {i < gridCount - 1 && (
                                  <button
                                    onClick={() => swapSlots(i, i + 1)}
                                    className="absolute bottom-1 right-1 h-5 px-1.5 rounded bg-black/60 text-white text-[10px] hover:bg-black/80"
                                  >→</button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => gridInputRef.current?.click()}
                                className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-primary/5 hover:text-primary transition"
                              >
                                <Plus className="h-5 w-5" />
                                <span className="text-[10px]">Cellule {i + 1}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Placement automatique. Cliquez sur ← → pour réordonner, × pour retirer.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-sm">
                        <RotateCw className="h-3.5 w-3.5" /> Orientation
                      </Label>
                      <Select value={orientation} onValueChange={setOrientation}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="landscape">Paysage</SelectItem>
                          <SelectItem value="portrait">Portrait</SelectItem>
                          <SelectItem value="landscape-flipped">Paysage inv.</SelectItem>
                          <SelectItem value="portrait-flipped">Portrait inv.</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-sm">
                        <Maximize2 className="h-3.5 w-3.5" /> Appliquer à toutes
                      </Label>
                      <Select
                        value={gridFit}
                        onValueChange={(v) => {
                          const nv = v as FitMode;
                          setGridFit(nv);
                          setSlots(prev => prev.map(s => (s.file ? { ...s, fit: nv } : s)));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cover">Remplir (cover)</SelectItem>
                          <SelectItem value="contain">Contenir (contain)</SelectItem>
                          <SelectItem value="fill">Étirer (fill)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Par défaut : images → Remplir, vidéos → Contenir. Cliquez sur le badge de chaque cellule pour l'ajuster.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm">
                      <CalendarDays className="h-3.5 w-3.5" /> Durée de diffusion
                    </Label>
                    <Select value={duration} onValueChange={handleDurationChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 heure</SelectItem>
                        <SelectItem value="120">2 heures</SelectItem>
                        <SelectItem value="480">8 heures</SelectItem>
                        <SelectItem value="1440">24 heures</SelectItem>
                        <SelectItem value="custom">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3 w-3" /> Début</Label>
                      <Input type="datetime-local" value={startTime} onChange={e => handleStartChange(e.target.value)} className="text-xs" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-xs"><Clock className="h-3 w-3" /> Fin</Label>
                      <Input type="datetime-local" value={endTime} onChange={e => { setEndTime(e.target.value); setDuration("custom"); }} className="text-xs" />
                    </div>
                  </div>

                  {uploading && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Upload de la grille…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleGridUpload}
                    className="w-full gap-2"
                    disabled={uploading || slots.slice(0, gridCount).filter(s => s.file).length < 2}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
                    {uploading ? `Envoi ${uploadProgress}%` : `Diffuser la grille ${gridPreset}`}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </>
        )}


        {step === "done" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-xl">Contenu envoyé !</CardTitle>
              <CardDescription>Votre contenu sera diffusé sur cet écran selon vos paramètres.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {preview && (
                isVideo ? (
                  <video src={preview} className="w-full h-40 object-cover rounded-lg border border-border mb-4" muted playsInline />
                ) : (
                  <img src={preview} alt="Uploaded" className="w-full h-40 object-cover rounded-lg border border-border mb-4" />
                )
              )}
              <Button
                variant="outline"
                onClick={() => { setStep("upload"); setFile(null); setPreview(null); }}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Envoyer un autre contenu
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
