import { useState } from "react";
import { Monitor, Smartphone, Tv, Copy, CheckCheck, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useScreens } from "@/hooks/useScreens";

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

export default function ScreenSetup() {
  const { screens } = useScreens();

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
              <div key={s.id} className="flex items-center gap-3 bg-muted/50 border rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <Badge variant="outline" className="text-[10px] shrink-0">{s.orientation}</Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-1">{playerUrl}{(s as any).slug || s.id}</p>
                </div>
                <a href={`${playerUrl}${(s as any).slug || s.id}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5" /></Button>
                </a>
                <CopyButton text={`${playerUrl}${(s as any).slug || s.id}`} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Aucun écran créé. Créez un écran dans l'onglet « Écrans » d'abord.</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="samsung" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="samsung" className="gap-1.5">
            <Tv className="h-4 w-4" /> Samsung
          </TabsTrigger>
          <TabsTrigger value="lg" className="gap-1.5">
            <Tv className="h-4 w-4" /> LG
          </TabsTrigger>
          <TabsTrigger value="philips" className="gap-1.5">
            <Monitor className="h-4 w-4" /> Philips
          </TabsTrigger>
          <TabsTrigger value="android" className="gap-1.5">
            <Smartphone className="h-4 w-4" /> Android
          </TabsTrigger>
        </TabsList>

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
