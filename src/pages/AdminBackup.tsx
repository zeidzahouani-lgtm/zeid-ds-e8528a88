import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Database, Download, Container, FileArchive, Loader2, Package, FileCode, Copy,
  Upload, CheckCircle2, XCircle, AlertCircle, ServerCog, Rocket, ShieldCheck,
} from "lucide-react";
import JSZip from "jszip";

const TABLES = [
  "profiles", "user_roles", "user_establishments", "establishments", "establishment_settings",
  "screens", "media", "playlists", "playlist_items", "programs", "schedules",
  "layouts", "layout_regions", "video_walls", "licenses", "contents",
  "notifications", "app_settings", "access_codes", "ai_requests",
  "registration_requests", "password_reset_requests", "inbox_emails", "email_actions",
];

const DOCKERFILE = `# ===== Build stage =====
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb* package-lock.json* ./
RUN if [ -f bun.lockb ]; then \\
      npm install -g bun && bun install --frozen-lockfile; \\
    else \\
      npm ci; \\
    fi

COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN npm run build

# ===== Runtime stage =====
FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;

const NGINX_CONF = `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
`;

const DOCKERIGNORE = `node_modules
dist
.git
.env
.env.local
*.log
.vscode
.idea
`;

function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildDockerCompose(env: "prod" | "staging", url: string, key: string, projectId: string, port: string) {
  return `version: "3.9"
services:
  screenflow-${env}:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: ${url || "<VITE_SUPABASE_URL>"}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${key || "<VITE_SUPABASE_PUBLISHABLE_KEY>"}
        VITE_SUPABASE_PROJECT_ID: ${projectId || "<VITE_SUPABASE_PROJECT_ID>"}
    image: screenflow:${env}
    container_name: screenflow-${env}
    restart: unless-stopped
    environment:
      NODE_ENV: ${env === "prod" ? "production" : "staging"}
    ports:
      - "${port}:80"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
`;
}

export default function AdminBackup() {
  const { isGlobalAdmin } = useEstablishmentContext();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [progressPct, setProgressPct] = useState(0);

  // Restore
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"upsert" | "insert">("upsert");
  const [restoreResults, setRestoreResults] = useState<Record<string, { ok: boolean; count: number; error?: string }> | null>(null);

  // ZIP verification state
  type ManifestEntry = { name: string; size: number; path: string; bucket: string; sha256?: string };
  type ZipPreview = {
    zip: JSZip;
    manifest: { generated_at?: string; files_count: number; files: ManifestEntry[] } | null;
    tablesPayload: Record<string, any[]>;
    fileChecks: Array<{ entry: ManifestEntry; present: boolean; actualSize?: number; sizeMatch?: boolean; sha256Match?: boolean }>;
    totalRows: number;
    totalFiles: number;
    totalBytes: number;
  };
  const [zipPreview, setZipPreview] = useState<ZipPreview | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [restoreFiles, setRestoreFiles] = useState(true);
  const [fileRestoreResults, setFileRestoreResults] = useState<{ ok: number; failed: number; errors: string[] } | null>(null);

  // Deployment guide
  const [envType, setEnvType] = useState<"prod" | "staging">("prod");
  const [envUrl, setEnvUrl] = useState(import.meta.env.VITE_SUPABASE_URL || "");
  const [envKey, setEnvKey] = useState(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  const [envProjectId, setEnvProjectId] = useState(import.meta.env.VITE_SUPABASE_PROJECT_ID || "");
  const [envPort, setEnvPort] = useState("8080");

  if (!isGlobalAdmin) return <Navigate to="/" replace />;

  // ============ EXPORTS ============

  const handleExportJSON = async () => {
    setExporting(true);
    const dump: Record<string, any> = {
      _meta: { exported_at: new Date().toISOString(), source: "ScreenFlow Backup", tables: TABLES },
    };
    try {
      let i = 0;
      for (const t of TABLES) {
        i++;
        setProgress(`Export ${t}...`);
        setProgressPct(Math.round((i / TABLES.length) * 100));
        const { data, error } = await (supabase as any).from(t).select("*");
        dump[t] = error ? { error: error.message } : (data || []);
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadText(`screenflow-backup-${stamp}.json`, JSON.stringify(dump, null, 2), "application/json");
      toast.success("Sauvegarde JSON téléchargée");
    } catch (e: any) {
      toast.error("Erreur d'export: " + e.message);
    } finally {
      setExporting(false);
      setProgress("");
      setProgressPct(0);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let i = 0;
      for (const t of TABLES) {
        i++;
        setProgress(`Export CSV ${t}...`);
        setProgressPct(Math.round((i / TABLES.length) * 100));
        const { data, error } = await (supabase as any).from(t).select("*");
        if (error || !data || data.length === 0) continue;
        const cols = Object.keys(data[0]);
        const escape = (v: any) => {
          if (v === null || v === undefined) return "";
          const s = typeof v === "object" ? JSON.stringify(v) : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        };
        const csv = [cols.join(","), ...data.map((r: any) => cols.map(c => escape(r[c])).join(","))].join("\n");
        downloadText(`${t}.csv`, csv, "text/csv");
        await new Promise(r => setTimeout(r, 150));
      }
      toast.success("Export CSV terminé");
    } catch (e: any) {
      toast.error("Erreur: " + e.message);
    } finally {
      setExporting(false);
      setProgress("");
      setProgressPct(0);
    }
  };

  const handleFullArchive = async () => {
    setExporting(true);
    const zip = new JSZip();
    try {
      // 1. Tables
      const dump: Record<string, any> = {
        _meta: { exported_at: new Date().toISOString(), source: "ScreenFlow Full Backup" },
      };
      let i = 0;
      const total = TABLES.length + 2;
      for (const t of TABLES) {
        i++;
        setProgress(`Données: ${t}...`);
        setProgressPct(Math.round((i / total) * 100));
        const { data, error } = await (supabase as any).from(t).select("*");
        dump[t] = error ? { error: error.message } : (data || []);
      }
      zip.file("database.json", JSON.stringify(dump, null, 2));

      // 2. Media bucket
      i++;
      setProgress("Listing du bucket 'media'...");
      setProgressPct(Math.round((i / total) * 100));
      const mediaFolder = zip.folder("media")!;
      const manifest: Array<{ name: string; size: number; path: string; bucket: string; sha256: string }> = [];

      const sha256Hex = async (blob: Blob) => {
        const buf = await blob.arrayBuffer();
        const hash = await crypto.subtle.digest("SHA-256", buf);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
      };

      const listAll = async (bucket: string, prefix = ""): Promise<string[]> => {
        const out: string[] = [];
        const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
        if (error || !data) return out;
        for (const item of data) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id === null) {
            const sub = await listAll(bucket, path);
            out.push(...sub);
          } else {
            out.push(path);
          }
        }
        return out;
      };

      for (const bucketName of ["media", "uploads"]) {
        const files = await listAll(bucketName);
        const bucketFolder = zip.folder(bucketName)!;
        let f = 0;
        for (const path of files) {
          f++;
          setProgress(`Téléchargement ${bucketName}: ${f}/${files.length} (${path})`);
          const { data: blob, error: dlErr } = await supabase.storage.from(bucketName).download(path);
          if (dlErr || !blob) {
            console.warn(`[backup] skip ${bucketName}/${path}:`, dlErr?.message);
            continue;
          }
          bucketFolder.file(path, blob);
          const sha256 = await sha256Hex(blob);
          manifest.push({ name: path, size: blob.size, path: `${bucketName}/${path}`, bucket: bucketName, sha256 });
        }
      }

      i++;
      setProgress("Génération de l'archive ZIP...");
      setProgressPct(Math.round((i / total) * 100));
      zip.file("manifest.json", JSON.stringify({
        generated_at: new Date().toISOString(),
        files_count: manifest.length,
        buckets: ["media", "uploads"],
        files: manifest,
      }, null, 2));
      zip.file("README.md", `# ScreenFlow Backup\n\nGénéré: ${new Date().toISOString()}\n\n- \`database.json\` : toutes les tables\n- \`media/\` : fichiers du bucket media\n- \`uploads/\` : fichiers du bucket uploads\n- \`manifest.json\` : index avec hashes SHA-256\n`);

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(`screenflow-full-backup-${stamp}.zip`, blob);
      toast.success(`Archive complète créée (${manifest.length} fichiers médias)`);
    } catch (e: any) {
      toast.error("Erreur: " + e.message);
    } finally {
      setExporting(false);
      setProgress("");
      setProgressPct(0);
    }
  };

  // ============ IMPORT / RESTORE ============

  const handleImportFile = async (file: File) => {
    setRestoring(true);
    setRestoreResults(null);
    try {
      let tablesPayload: Record<string, any[]> = {};

      if (file.name.endsWith(".json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        for (const [k, v] of Object.entries(parsed)) {
          if (k.startsWith("_")) continue;
          if (Array.isArray(v)) tablesPayload[k] = v;
        }
      } else if (file.name.endsWith(".csv")) {
        const tableName = file.name.replace(/\.csv$/, "");
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.length);
        if (lines.length < 2) throw new Error("CSV vide");
        const parseCSVLine = (line: string): string[] => {
          const out: string[] = [];
          let cur = "", inQ = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (inQ) {
              if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
              else if (c === '"') inQ = false;
              else cur += c;
            } else {
              if (c === '"') inQ = true;
              else if (c === ",") { out.push(cur); cur = ""; }
              else cur += c;
            }
          }
          out.push(cur);
          return out;
        };
        const headers = parseCSVLine(lines[0]);
        const rows = lines.slice(1).map(l => {
          const vals = parseCSVLine(l);
          const obj: any = {};
          headers.forEach((h, idx) => {
            const v = vals[idx];
            if (v === "" || v === undefined) { obj[h] = null; return; }
            try { obj[h] = JSON.parse(v); } catch { obj[h] = v; }
          });
          return obj;
        });
        tablesPayload[tableName] = rows;
      } else {
        throw new Error("Format non supporté (.json ou .csv attendu)");
      }

      const totalRows = Object.values(tablesPayload).reduce((s, r) => s + r.length, 0);
      if (totalRows === 0) throw new Error("Aucune donnée à restaurer");

      const confirm = window.confirm(
        `Restaurer ${totalRows} lignes dans ${Object.keys(tablesPayload).length} table(s) en mode "${restoreMode}" ?\n\n⚠ Le mode "upsert" remplacera les enregistrements ayant le même ID.`
      );
      if (!confirm) { setRestoring(false); return; }

      const { data, error } = await supabase.functions.invoke("restore-backup", {
        body: { tables: tablesPayload, mode: restoreMode },
      });
      if (error) throw error;
      setRestoreResults(data.results);
      const okCount = Object.values(data.results as any).filter((r: any) => r.ok).length;
      toast.success(`Restauration terminée: ${okCount}/${Object.keys(data.results).length} tables OK`);
    } catch (e: any) {
      toast.error("Erreur de restauration: " + e.message);
    } finally {
      setRestoring(false);
    }
  };

  // ============ DOCKER ============

  const dockerCompose = buildDockerCompose(envType, envUrl, envKey, envProjectId, envPort);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const downloadDockerBundle = () => {
    downloadText("Dockerfile", DOCKERFILE);
    setTimeout(() => downloadText("nginx.conf", NGINX_CONF), 200);
    setTimeout(() => downloadText("docker-compose.yml", dockerCompose, "text/yaml"), 400);
    setTimeout(() => downloadText(".dockerignore", DOCKERIGNORE), 600);
    toast.success("Fichiers Docker téléchargés");
  };

  // ============ ENV CHECK ============

  const envChecks = [
    { name: "VITE_SUPABASE_URL", value: envUrl, valid: /^https?:\/\/.+\.supabase\.co$/.test(envUrl) },
    { name: "VITE_SUPABASE_PUBLISHABLE_KEY", value: envKey, valid: envKey.length > 40 },
    { name: "VITE_SUPABASE_PROJECT_ID", value: envProjectId, valid: envProjectId.length > 10 },
  ];
  const allValid = envChecks.every(c => c.valid);

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backup & Déploiement</h1>
        <p className="text-muted-foreground mt-1">
          Sauvegarde, restauration et configuration de déploiement Docker.
        </p>
      </div>

      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backup" className="gap-2"><Database className="h-4 w-4" />Sauvegarde</TabsTrigger>
          <TabsTrigger value="restore" className="gap-2"><Upload className="h-4 w-4" />Restauration</TabsTrigger>
          <TabsTrigger value="env" className="gap-2"><ShieldCheck className="h-4 w-4" />Vérif. Env</TabsTrigger>
          <TabsTrigger value="docker" className="gap-2"><Container className="h-4 w-4" />Docker</TabsTrigger>
        </TabsList>

        {/* ============ BACKUP TAB ============ */}
        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" />Exporter les données</CardTitle>
              <CardDescription>Téléchargez toutes les tables au format JSON, CSV, ou une archive complète avec les médias.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TABLES.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
              <Separator />
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExportJSON} disabled={exporting} className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Sauvegarde JSON
                </Button>
                <Button onClick={handleExportCSV} disabled={exporting} variant="outline" className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export CSV (par table)
                </Button>
                <Button onClick={handleFullArchive} disabled={exporting} variant="default" className="gap-2 bg-primary">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  Archive complète (DB + médias)
                </Button>
              </div>
              {progress && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{progress}</p>
                  <Progress value={progressPct} className="h-2" />
                </div>
              )}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  L'archive complète inclut les buckets <code>media</code> et <code>uploads</code>. Le téléchargement peut prendre plusieurs minutes selon le volume.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ RESTORE TAB ============ */}
        <TabsContent value="restore" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Restaurer une sauvegarde</CardTitle>
              <CardDescription>Importez un fichier JSON (multi-tables) ou CSV (table unique nommée selon le fichier).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Action critique</AlertTitle>
                <AlertDescription className="text-xs">
                  Le mode <strong>upsert</strong> remplace les enregistrements existants par ID. Le mode <strong>insert</strong> échoue sur les doublons. Faites une sauvegarde au préalable.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Mode d'import</Label>
                  <Select value={restoreMode} onValueChange={(v: any) => setRestoreMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upsert">Upsert (remplacer si existe)</SelectItem>
                      <SelectItem value="insert">Insert seulement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fichier (.json ou .csv)</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv"
                    disabled={restoring}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>

              {restoring && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restauration en cours...
                </div>
              )}

              {restoreResults && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Résultats</h3>
                  <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                    {Object.entries(restoreResults).map(([table, r]) => (
                      <div key={table} className="flex items-center justify-between p-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          <code className="text-xs">{table}</code>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.ok ? `${r.count} ligne(s)` : <span className="text-destructive">{r.error}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ ENV CHECK TAB ============ */}
        <TabsContent value="env" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Vérification des variables d'environnement</CardTitle>
              <CardDescription>Validez vos variables Supabase et générez un guide de déploiement adapté.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Type d'environnement</Label>
                  <Select value={envType} onValueChange={(v: any) => setEnvType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prod">Production</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">VITE_SUPABASE_URL</Label>
                  <Input value={envUrl} onChange={e => setEnvUrl(e.target.value)} placeholder="https://xxx.supabase.co" className="font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</Label>
                  <Input value={envKey} onChange={e => setEnvKey(e.target.value)} placeholder="eyJhbGc..." className="font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">VITE_SUPABASE_PROJECT_ID</Label>
                  <Input value={envProjectId} onChange={e => setEnvProjectId(e.target.value)} placeholder="abcdefgh..." className="font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Port d'écoute Docker</Label>
                  <Input value={envPort} onChange={e => setEnvPort(e.target.value)} className="font-mono text-xs" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Diagnostic</h3>
                <div className="border rounded-lg divide-y">
                  {envChecks.map(c => (
                    <div key={c.name} className="flex items-center justify-between p-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        {c.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                        <code className="text-xs">{c.name}</code>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {c.valid ? "Valide" : c.value ? "Format invalide" : "Manquant"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {!allValid && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Corrigez les variables ci-dessus avant le déploiement.
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Rocket className="h-4 w-4" />Guide de déploiement {envType === "prod" ? "Production" : "Staging"}
                  </h3>
                </div>

                <div className="text-sm text-muted-foreground space-y-2 bg-muted/40 p-4 rounded-lg">
                  <p className="font-semibold text-foreground">Étapes recommandées :</p>
                  <ol className="list-decimal pl-5 space-y-1 text-xs">
                    <li>Téléchargez les fichiers Docker depuis l'onglet « Docker »</li>
                    <li>Placez-les à la racine de votre projet</li>
                    <li>Créez un fichier <code className="bg-background px-1 rounded">.env.{envType}</code> avec vos 3 variables</li>
                    {envType === "prod" && <li>Configurez un reverse-proxy (Nginx/Traefik) avec HTTPS (Let's Encrypt)</li>}
                    {envType === "prod" && <li>Activez les sauvegardes automatiques quotidiennes (cron + onglet « Sauvegarde »)</li>}
                    {envType === "staging" && <li>Restreignez l'accès via Basic Auth ou IP allowlist</li>}
                    <li>Lancez : <code className="bg-background px-1 rounded">docker compose up -d --build</code></li>
                    <li>Vérifiez : <code className="bg-background px-1 rounded">curl http://localhost:{envPort}</code></li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-semibold">docker-compose.{envType}.yml</code>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(dockerCompose, "docker-compose")} className="gap-1.5 h-7" disabled={!allValid}>
                        <Copy className="h-3 w-3" />Copier
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadText(`docker-compose.${envType}.yml`, dockerCompose, "text/yaml")} className="gap-1.5 h-7">
                        <Download className="h-3 w-3" />Télécharger
                      </Button>
                    </div>
                  </div>
                  <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-72 border">{dockerCompose}</pre>
                </div>

                <div className="space-y-2">
                  <code className="text-sm font-semibold">Commande prête à copier</code>
                  <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg border">
                    <code className="flex-1 text-xs overflow-x-auto whitespace-nowrap">
                      docker compose -f docker-compose.{envType}.yml up -d --build
                    </code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`docker compose -f docker-compose.${envType}.yml up -d --build`, "Commande")} className="gap-1.5 h-7">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ DOCKER TAB ============ */}
        <TabsContent value="docker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ServerCog className="h-5 w-5" />Fichiers Docker</CardTitle>
              <CardDescription>Téléchargez les fichiers de configuration pour conteneuriser l'application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={downloadDockerBundle} className="gap-2">
                <Download className="h-4 w-4" />Télécharger tout
              </Button>

              <Separator />

              {[
                { name: "Dockerfile", content: DOCKERFILE },
                { name: "nginx.conf", content: NGINX_CONF },
                { name: `docker-compose.${envType}.yml`, content: dockerCompose },
                { name: ".dockerignore", content: DOCKERIGNORE },
              ].map(f => (
                <div key={f.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-semibold">{f.name}</code>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(f.content, f.name)} className="gap-1.5 h-7">
                        <Copy className="h-3 w-3" />Copier
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadText(f.name, f.content)} className="gap-1.5 h-7">
                        <Download className="h-3 w-3" />Télécharger
                      </Button>
                    </div>
                  </div>
                  <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto max-h-60 border">{f.content}</pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
