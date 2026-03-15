import { useState, useRef, useCallback } from "react";
import { Monitor, Smartphone, Tv, Copy, CheckCheck, ExternalLink, Pencil, Check, X, Bot, Send, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useScreens } from "@/hooks/useScreens";
import ReactMarkdown from "react-markdown";

const playerUrl = window.location.origin + "/player/";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copié !");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
      {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3 mt-4">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
            {i + 1}
          </span>
          <span className="text-sm text-foreground leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ScreenRow({ screen, updateScreen }: { screen: any; updateScreen: any }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(screen.name);
  const url = `${playerUrl}${screen.slug || screen.id}`;

  const handleSave = () => {
    if (!name.trim()) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
    updateScreen.mutate({ id: screen.id, name: name.trim(), slug } as any);
    setEditing(false);
    toast.success("Écran renommé !");
  };

  const handleCancel = () => {
    setName(screen.name);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3 bg-muted/50 border rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary shrink-0" />
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 text-sm w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
                <Check className="h-3.5 w-3.5 text-green-500" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
                <X className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold truncate">{screen.name}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            </>
          )}
          <Badge variant="outline" className="text-[10px] shrink-0">{screen.orientation}</Badge>
        </div>
        <p className="font-mono text-xs text-muted-foreground mt-1">{url}</p>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
      </a>
      <CopyButton text={url} />
    </div>
  );
}

function AIGuideTab() {
  const [model, setModel] = useState("");
  const [guide, setGuide] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    if (!model.trim() || isLoading) return;
    setGuide("");
    setIsLoading(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/screen-setup-guide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ model: model.trim() }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erreur inconnue" }));
        toast.error(err.error || "Erreur lors de la génération du guide");
        setIsLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setIsLoading(false); return; }
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setGuide(accumulated);
              if (contentRef.current) {
                contentRef.current.scrollTop = contentRef.current.scrollHeight;
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur de connexion au service IA");
    } finally {
      setIsLoading(false);
    }
  }, [model, isLoading]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Assistant IA de configuration
          </CardTitle>
          <Badge variant="secondary">IA</Badge>
        </div>
        <CardDescription>
          Entrez le modèle exact de votre écran et l'IA générera un guide de configuration personnalisé
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ex: Samsung QM55R, LG 55UH5F, Philips 55BDL4050D..."
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleGenerate} disabled={!model.trim() || isLoading} className="gap-1.5">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isLoading ? "Génération..." : "Générer"}
          </Button>
        </div>

        {(guide || isLoading) && (
          <div
            ref={contentRef}
            className="border border-border rounded-lg p-4 max-h-[500px] overflow-y-auto bg-muted/30"
          >
            {guide ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{guide}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recherche des informations pour votre écran...
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs text-muted-foreground">
            <strong>Exemples de modèles :</strong> Samsung QBR, Samsung QM55R, LG 55SM5KE, LG 55UH5F-H, 
            Philips 55BDL4050D, Sony FW-55BZ35F, NEC MultiSync, BenQ ST550K, Fire TV Stick 4K, Raspberry Pi 4
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScreenSetup() {
  const { screens, updateScreen } = useScreens();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Monitor className="h-6 w-6 text-primary" /> Configuration des écrans
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Guide d'installation pour connecter vos écrans à la plateforme
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">URLs de vos écrans</CardTitle>
          <CardDescription>
            Copiez l'URL complète de l'écran à configurer et collez-la dans le navigateur de votre appareil
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {screens && screens.length > 0 ? (
            screens.map((s: any) => (
              <ScreenRow key={s.id} screen={s} updateScreen={updateScreen} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aucun écran créé. Créez un écran dans l'onglet « Écrans » d'abord.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ai" className="gap-1.5"><Bot className="h-4 w-4" /> Assistant IA</TabsTrigger>
          <TabsTrigger value="samsung" className="gap-1.5"><Tv className="h-4 w-4" /> Samsung</TabsTrigger>
          <TabsTrigger value="lg" className="gap-1.5"><Tv className="h-4 w-4" /> LG</TabsTrigger>
          <TabsTrigger value="philips" className="gap-1.5"><Monitor className="h-4 w-4" /> Philips</TabsTrigger>
          <TabsTrigger value="android" className="gap-1.5"><Smartphone className="h-4 w-4" /> Android</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <AIGuideTab />
        </TabsContent>

        <TabsContent value="samsung">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Samsung Smart Signage (Tizen)</CardTitle>
                <Badge>SSSP / Tizen</Badge>
              </div>
              <CardDescription>Écrans Samsung série QBR, QMR, QHR, OMN et similaires</CardDescription>
            </CardHeader>
            <CardContent>
              <StepList steps={[
                "Allumez l'écran et accédez au menu en appuyant sur le bouton Home de la télécommande.",
                "Allez dans « Menu » → « Système » → « Changer le mode MagicINFO / URL Launcher ».",
                "Sélectionnez « URL Launcher » comme mode de lecture.",
                "Dans « Paramètres URL Launcher », entrez l'URL du player avec l'ID de votre écran.",
                "Configurez le réseau (Wi-Fi ou Ethernet) dans « Menu » → « Réseau » → « Paramètres réseau ».",
                "Activez le « Mode veille réseau » dans les paramètres d'alimentation pour permettre le réveil à distance.",
                "Réglez le « Timer automatique » sur « On » et configurez les heures de démarrage/arrêt selon vos besoins.",
                "Redémarrez l'écran. L'URL Launcher se lancera automatiquement avec votre contenu."
              ]} />
              <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  <strong>Astuce :</strong> Pour les modèles SSSP D/SSSP 6+, vous pouvez aussi utiliser le navigateur web intégré. 
                  Activez « Kiosk Mode » pour empêcher les utilisateurs de quitter le player.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lg">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">LG webOS Signage</CardTitle>
                <Badge>webOS</Badge>
              </div>
              <CardDescription>Écrans LG série SM5K, UH5F, UL3J et similaires</CardDescription>
            </CardHeader>
            <CardContent>
              <StepList steps={[
                "Allumez l'écran et appuyez sur le bouton « Settings » de la télécommande.",
                "Naviguez vers « Ez Setting » → « SI Server Setting » ou « URL Setting ».",
                "Sélectionnez « Application Launch Setting » → « Set URL ».",
                "Entrez l'URL du player avec l'ID de votre écran dans le champ URL.",
                "Allez dans « Network » → configurez votre connexion Wi-Fi ou Ethernet.",
                "Dans « General » → « Crestron Connected » : désactivez si non utilisé.",
                "Configurez « Timer » → « On Timer / Off Timer » pour les horaires de fonctionnement.",
                "Redémarrez l'écran. L'application URL se lancera automatiquement."
              ]} />
              <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  <strong>Astuce :</strong> Pour les modèles webOS 4.0+, utilisez « SoftAP » pour configurer le réseau sans câble. 
                  Activez « USB Lock » et « IR Lock » pour sécuriser l'écran.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="philips">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Philips Professional Display</CardTitle>
                <Badge>Android SoC</Badge>
              </div>
              <CardDescription>Écrans Philips série BDL, 10BDL et similaires avec Android intégré</CardDescription>
            </CardHeader>
            <CardContent>
              <StepList steps={[
                "Allumez l'écran et accédez au menu admin en appuyant sur « Home 1 8 8 8 » sur la télécommande.",
                "Allez dans « Configuration » → « Signage Display » → « Source Settings ».",
                "Sélectionnez « Custom App » ou « HTML5 Browser » comme source de démarrage.",
                "Dans « Custom App » → « Set URL », entrez l'URL du player.",
                "Configurez le réseau dans « Configuration » → « Network Settings ».",
                "Activez « Auto Start » pour que l'application se lance au démarrage.",
                "Configurez les « Schedule » pour les heures On/Off dans les paramètres d'alimentation.",
                "Redémarrez l'écran pour appliquer les changements."
              ]} />
              <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  <strong>Astuce :</strong> Pour les modèles avec CMND, vous pouvez gérer la configuration à distance. 
                  Le code PIN admin par défaut est généralement « 1234 ».
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="android">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Android TV / Box</CardTitle>
                <Badge>Android</Badge>
              </div>
              <CardDescription>Android TV, Fire TV Stick, Xiaomi Mi Box, boîtiers Android génériques</CardDescription>
            </CardHeader>
            <CardContent>
              <StepList steps={[
                "Connectez le boîtier Android à l'écran via HDMI et au réseau via Wi-Fi ou Ethernet.",
                "Installez un navigateur en mode kiosk depuis le Play Store (ex: Fully Kiosk Browser, Kiosk Browser Lockdown).",
                "Ouvrez l'application kiosk et configurez l'URL du player avec l'ID de votre écran.",
                "Activez le « Kiosk Mode » pour empêcher la sortie du navigateur.",
                "Dans les paramètres du kiosk, activez « Launch on Boot » pour un démarrage automatique.",
                "Configurez « Screen Wake / Sleep » selon les horaires souhaités.",
                "Désactivez les mises à jour automatiques du système pour éviter les interruptions.",
                "Testez le player en redémarrant le boîtier."
              ]} />
              <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  <strong>Fully Kiosk Browser</strong> (recommandé) : licence à ~7€, offre le contrôle à distance, le wake-on-motion, 
                  et la gestion complète du kiosk. Alternative gratuite : « Kiosk Browser Lockdown ».
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
