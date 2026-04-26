import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Download, Container, FileArchive, Loader2, Package, FileCode, Copy } from "lucide-react";

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

# Install deps
COPY package.json bun.lockb* package-lock.json* ./
RUN if [ -f bun.lockb ]; then \\
      npm install -g bun && bun install --frozen-lockfile; \\
    else \\
      npm ci; \\
    fi

# Build
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

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Long cache for assets
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
`;

const DOCKER_COMPOSE = `version: "3.9"
services:
  screenflow:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: \${VITE_SUPABASE_URL}
        VITE_SUPABASE_PUBLISHABLE_KEY: \${VITE_SUPABASE_PUBLISHABLE_KEY}
        VITE_SUPABASE_PROJECT_ID: \${VITE_SUPABASE_PROJECT_ID}
    image: screenflow:latest
    container_name: screenflow
    restart: unless-stopped
    ports:
      - "8080:80"
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

export default function AdminBackup() {
  const { isGlobalAdmin, loading } = useEstablishmentContext();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<string>("");

  if (loading) return <div className="p-8 text-muted-foreground">Chargement...</div>;
  if (!isGlobalAdmin) return <Navigate to="/" replace />;

  const handleExportJSON = async () => {
    setExporting(true);
    const dump: Record<string, any> = {
      _meta: {
        exported_at: new Date().toISOString(),
        source: "ScreenFlow Backup",
        tables: TABLES,
      },
    };
    try {
      for (const t of TABLES) {
        setProgress(`Export ${t}...`);
        const { data, error } = await (supabase as any).from(t).select("*");
        if (error) {
          console.warn(`[backup] ${t}:`, error.message);
          dump[t] = { error: error.message };
        } else {
          dump[t] = data || [];
        }
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadText(`screenflow-backup-${stamp}.json`, JSON.stringify(dump, null, 2), "application/json");
      toast.success("Sauvegarde JSON téléchargée");
    } catch (e: any) {
      toast.error("Erreur d'export: " + e.message);
    } finally {
      setExporting(false);
      setProgress("");
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      for (const t of TABLES) {
        setProgress(`Export CSV ${t}...`);
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
      toast.success("Sauvegarde CSV téléchargée (un fichier par table)");
    } catch (e: any) {
      toast.error("Erreur: " + e.message);
    } finally {
      setExporting(false);
      setProgress("");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const downloadDockerBundle = () => {
    downloadText("Dockerfile", DOCKERFILE);
    setTimeout(() => downloadText("nginx.conf", NGINX_CONF), 200);
    setTimeout(() => downloadText("docker-compose.yml", DOCKER_COMPOSE, "text/yaml"), 400);
    setTimeout(() => downloadText(".dockerignore", DOCKERIGNORE), 600);
    toast.success("Fichiers Docker téléchargés");
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Backup & Déploiement</h1>
        <p className="text-muted-foreground mt-1">
          Sauvegarde des données et configuration de déploiement Docker.
        </p>
      </div>

      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backup" className="gap-2"><Database className="h-4 w-4" />Sauvegarde</TabsTrigger>
          <TabsTrigger value="docker" className="gap-2"><Container className="h-4 w-4" />Déploiement Docker</TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" />Exporter la base de données</CardTitle>
              <CardDescription>
                Télécharge l'intégralité des tables de l'application au format JSON ou CSV.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {TABLES.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
              <Separator />
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleExportJSON} disabled={exporting} className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Sauvegarde JSON complète
                </Button>
                <Button onClick={handleExportCSV} disabled={exporting} variant="outline" className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export CSV (par table)
                </Button>
              </div>
              {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                ⓘ La sauvegarde n'inclut pas les fichiers de stockage (images, vidéos). 
                Pour une sauvegarde complète des médias, utilisez le tableau de bord backend.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Déployer sur Docker</CardTitle>
              <CardDescription>
                Téléchargez les fichiers de configuration Docker pour conteneuriser l'application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={downloadDockerBundle} className="gap-2">
                  <Download className="h-4 w-4" />
                  Télécharger les fichiers Docker
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2"><FileCode className="h-4 w-4" />Étapes de déploiement</h3>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pl-5">
                  <li>Téléchargez les fichiers ci-dessus à la racine du projet</li>
                  <li>Créez un fichier <code className="bg-muted px-1 rounded">.env</code> avec vos variables Supabase</li>
                  <li>Lancez : <code className="bg-muted px-1 rounded">docker compose up -d --build</code></li>
                  <li>L'application sera accessible sur <code className="bg-muted px-1 rounded">http://localhost:8080</code></li>
                </ol>
              </div>

              <Separator />

              {[
                { name: "Dockerfile", content: DOCKERFILE },
                { name: "nginx.conf", content: NGINX_CONF },
                { name: "docker-compose.yml", content: DOCKER_COMPOSE },
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

              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                ⓘ Pour construire uniquement l'image Docker : <br />
                <code>docker build -t screenflow:latest --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... --build-arg VITE_SUPABASE_PROJECT_ID=... .</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
