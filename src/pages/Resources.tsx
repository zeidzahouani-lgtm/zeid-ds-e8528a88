import { useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Download, Monitor, Tv, Image, ListMusic, Clock, LayoutGrid,
  Sparkles, Shield, Cloud, Zap, Eye, Users, Settings, Mail,
  BookOpen, Rocket, Target, Layers, Globe, Lock,
  ChevronRight, Play, Upload, Palette, Bell, Server,
  Smartphone, Wifi, RefreshCw, Volume2, AlertTriangle, CheckCircle2
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import screenshotLogin from "@/assets/screenshots/login-screen.png";
import screenshotScreens from "@/assets/screenshots/screens-management.png";
import screenshotMedia from "@/assets/screenshots/media-library.png";
import screenshotLayout from "@/assets/screenshots/layout-editor.png";
import screenshotSchedule from "@/assets/screenshots/schedule-view.png";
import screenshotAI from "@/assets/screenshots/ai-assistant.png";
import screenshotAutoflow from "@/assets/screenshots/autoflow-email.png";
import screenshotAdmin from "@/assets/screenshots/admin-panel.png";

/* ──────────── PDF Export ──────────── */
async function exportToPDF(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    backgroundColor: "#0B0F1A",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const imgW = canvas.width;
  const imgH = canvas.height;
  const ratio = pdfW / imgW;
  let heightLeft = imgH * ratio;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, pdfW, imgH * ratio);
  heightLeft -= pdfH;

  while (heightLeft > 0) {
    position -= pdfH;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pdfW, imgH * ratio);
    heightLeft -= pdfH;
  }

  pdf.save(filename);
}

/* ──────────── Data ──────────── */
const features = [
  { icon: Monitor, title: "Affichage Dynamique", desc: "Gérez vos écrans à distance avec une interface intuitive et puissante." },
  { icon: LayoutGrid, title: "Layouts Personnalisables", desc: "Créez des mises en page multi-zones avec un éditeur visuel drag & drop." },
  { icon: ListMusic, title: "Playlists Intelligentes", desc: "Organisez vos contenus en playlists avec rotation et durée configurables." },
  { icon: Clock, title: "Programmation Avancée", desc: "Planifiez l'affichage par jour, heure et écran avec une granularité fine." },
  { icon: Sparkles, title: "Assistant IA Intégré", desc: "Générez du contenu et obtenez des recommandations grâce à l'intelligence artificielle." },
  { icon: Mail, title: "Flux Automatique", desc: "Recevez et publiez du contenu par email automatiquement sur vos écrans." },
  { icon: Shield, title: "Licences & Sécurité", desc: "Système de licences par écran avec validation en temps réel et RLS." },
  { icon: Users, title: "Multi-Établissements", desc: "Gérez plusieurs établissements avec des rôles et permissions granulaires." },
];

const manualSections = [
  {
    id: "installation",
    title: "1. Installation & Premier Démarrage",
    icon: Rocket,
    steps: [
      "Accédez à la plateforme via votre navigateur web (Chrome, Firefox, Edge recommandés).",
      "Créez votre compte via le formulaire d'inscription ou contactez votre administrateur.",
      "Vérifiez votre email et connectez-vous avec vos identifiants.",
      "Lors de la première connexion, vous serez guidé vers le tableau de bord principal.",
    ],
    screenshot: screenshotLogin,
    screenshotAlt: "Écran de connexion avec formulaire d'authentification",
  },
  {
    id: "screens",
    title: "2. Configuration des Écrans",
    icon: Tv,
    steps: [
      "Naviguez vers 'Écrans' dans le menu latéral pour voir la liste de vos écrans.",
      "Cliquez sur 'Ajouter un écran' et renseignez le nom et l'orientation (paysage/portrait).",
      "Récupérez l'URL Player unique générée pour chaque écran.",
      "Sur votre écran physique, ouvrez le navigateur et collez l'URL Player.",
      "L'écran apparaîtra comme 'En ligne' dans le tableau de bord une fois connecté.",
    ],
    screenshot: screenshotScreens,
    screenshotAlt: "Page de gestion des écrans avec statuts en temps réel",
  },
  {
    id: "content",
    title: "3. Gestion du Contenu",
    icon: Image,
    steps: [
      "Accédez à la 'Bibliothèque' pour voir tous vos médias (images, vidéos).",
      "Glissez-déposez vos fichiers ou utilisez le bouton 'Uploader' pour ajouter du contenu.",
      "Définissez la durée d'affichage par défaut pour chaque média.",
      "Organisez vos médias en playlists depuis la section 'Playlists'.",
      "Réorganisez l'ordre des médias par glisser-déposer dans la playlist.",
    ],
    screenshot: screenshotMedia,
    screenshotAlt: "Bibliothèque de médias avec vignettes et options d'upload",
  },
  {
    id: "layouts",
    title: "4. Création de Layouts",
    icon: LayoutGrid,
    steps: [
      "Ouvrez la section 'Layouts' et cliquez sur 'Nouveau Layout'.",
      "Utilisez l'éditeur visuel pour définir des zones d'affichage sur le canevas.",
      "Ajoutez des widgets (horloge, météo, texte défilant, QR code) dans les zones.",
      "Assignez des médias ou playlists à chaque zone.",
      "Sauvegardez et assignez le layout à un ou plusieurs écrans.",
    ],
    screenshot: screenshotLayout,
    screenshotAlt: "Éditeur de layout avec zones drag & drop et widgets",
  },
  {
    id: "schedules",
    title: "5. Programmation",
    icon: Clock,
    steps: [
      "Accédez à 'Programmation' pour créer des plages horaires d'affichage.",
      "Sélectionnez l'écran cible, le programme et les jours de la semaine.",
      "Définissez les heures de début et de fin pour chaque plage.",
      "Activez ou désactivez les programmations selon vos besoins.",
      "Les contenus s'afficheront automatiquement selon le planning défini.",
    ],
    screenshot: screenshotSchedule,
    screenshotAlt: "Calendrier de programmation avec plages horaires configurées",
  },
  {
    id: "ai",
    title: "6. Assistant IA",
    icon: Sparkles,
    steps: [
      "Ouvrez l''Assistant IA' depuis le menu latéral.",
      "Décrivez le contenu que vous souhaitez générer en langage naturel.",
      "L'IA analysera votre demande et proposera du contenu adapté.",
      "Validez, modifiez ou régénérez les suggestions selon vos besoins.",
      "Publiez directement le contenu généré sur vos écrans.",
    ],
    screenshot: screenshotAI,
    screenshotAlt: "Interface de l'assistant IA avec chat et suggestions",
  },
  {
    id: "autoflow",
    title: "7. Flux Automatique (Email)",
    icon: Mail,
    steps: [
      "Configurez votre adresse email de réception dans les paramètres.",
      "Envoyez un email avec une image en pièce jointe à l'adresse configurée.",
      "Le système reçoit et traite automatiquement les pièces jointes.",
      "Les contenus sont ajoutés en attente de validation ou publiés directement.",
      "Suivez l'historique des emails reçus dans la section 'Flux Automatique'.",
    ],
    screenshot: screenshotAutoflow,
    screenshotAlt: "Page du flux automatique avec historique des emails traités",
  },
  {
    id: "fullykiosk",
    title: "8. Configuration Android — Fully Kiosk Browser",
    icon: Smartphone,
    steps: [
      "Téléchargez et installez l'APK Fully Kiosk Browser depuis le site officiel (fully-kiosk.com).",
      "Lancez l'application et entrez l'URL Player de votre écran comme page de démarrage.",
      "Accédez aux paramètres Fully Kiosk (glissez depuis le bord gauche ou tapez le mot de passe admin).",
      "Activez le mode Kiosque pour verrouiller l'appareil sur l'application.",
      "Configurez le redémarrage automatique et la gestion de l'écran selon vos besoins.",
    ],
  },
  {
    id: "admin",
    title: "9. Administration",
    icon: Settings,
    steps: [
      "Les administrateurs accèdent aux sections dédiées dans le menu 'Administration'.",
      "Gérez les utilisateurs : invitations, rôles (admin, utilisateur), désactivation.",
      "Configurez les établissements : nom, logo, paramètres spécifiques.",
      "Gérez les licences : activation, désactivation, suivi des expirations.",
      "Personnalisez l'apparence globale : logo, couleurs, messages d'accueil.",
    ],
    screenshot: screenshotAdmin,
    screenshotAlt: "Panneau d'administration avec gestion des utilisateurs",
  },
];

/* ──────────── Components ──────────── */

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="group hover:border-primary/40 transition-all duration-300">
      <CardContent className="p-5">
        <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center mb-3 shadow-glow-blue group-hover:scale-110 transition-transform">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <h3 className="font-semibold text-foreground mb-1.5 text-sm">{title}</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

function ManualScreenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-primary/20 shadow-glow-blue my-4">
      <img
        src={src}
        alt={alt}
        className="w-full h-auto object-cover"
        loading="lazy"
      />
      <div className="bg-card/80 px-4 py-2 border-t border-primary/10">
        <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-primary/60" />
          {alt}
        </p>
      </div>
    </div>
  );
}

/* ──────────── Main Page ──────────── */
export default function Resources() {
  const presentationRef = useRef<HTMLDivElement>(null);
  const manualRef = useRef<HTMLDivElement>(null);

  const handleExportPresentation = () => {
    if (presentationRef.current) exportToPDF(presentationRef.current, "Presentation-ZeidDS.pdf");
  };

  const handleExportManual = () => {
    if (manualRef.current) exportToPDF(manualRef.current, "Manuel-Utilisation-ZeidDS.pdf");
  };

  return (
    <div className="space-y-6 animate-cyber-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-primary-text">Ressources</h1>
          <p className="text-muted-foreground text-sm mt-1">Présentation commerciale et manuel d'utilisation</p>
        </div>
      </div>

      <Tabs defaultValue="presentation" className="space-y-6">
        <TabsList className="glass-panel">
          <TabsTrigger value="presentation" className="gap-1.5">
            <Rocket className="h-4 w-4" /> Présentation
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Manuel d'Utilisation
          </TabsTrigger>
        </TabsList>

        {/* ═══════ PRESENTATION TAB ═══════ */}
        <TabsContent value="presentation">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleExportPresentation} className="gap-2">
                <Download className="h-4 w-4" /> Télécharger la Présentation (PDF)
              </Button>
            </div>

            <div ref={presentationRef} className="space-y-8">
              {/* Hero */}
              <Card className="overflow-hidden">
                <div className="relative p-8 md:p-12 text-center space-y-4">
                  <div className="absolute inset-0 gradient-primary opacity-[0.07]" />
                  <div className="relative z-10 space-y-4">
                    <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow-blue">
                      <Monitor className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold gradient-primary-text">Solution d'Affichage Dynamique</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
                      Plateforme cloud complète pour gérer, programmer et diffuser vos contenus sur écrans numériques en toute simplicité.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Vision */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow-blue">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle>Notre Vision</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Nous croyons que l'affichage dynamique devrait être accessible, intuitif et puissant. Notre plateforme permet à tout établissement — des petits commerces aux grandes institutions — de communiquer efficacement avec leur audience via des écrans numériques.
                  </p>
                  <p>
                    Grâce à une architecture cloud moderne, une intelligence artificielle intégrée et une interface pensée pour la simplicité, nous transformons la gestion de contenu visuel en une expérience fluide et productive.
                  </p>
                </CardContent>
              </Card>

              {/* Features */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow-blue">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Fonctionnalités Clés</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {features.map((f) => (
                    <FeatureCard key={f.title} {...f} />
                  ))}
                </div>
              </div>

              {/* Architecture */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow-blue">
                      <Layers className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle>Architecture du Système</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { icon: Globe, title: "Frontend React", items: ["Interface SPA réactive", "Composants modulaires", "Thème clair/sombre", "PWA compatible"] },
                      { icon: Cloud, title: "Backend Cloud", items: ["Base de données PostgreSQL", "Authentification sécurisée", "Edge Functions serverless", "Stockage fichiers S3"] },
                      { icon: Server, title: "Player & Temps Réel", items: ["WebSocket temps réel", "Heartbeat monitoring", "Validation de licences", "Mode offline (fallback)"] },
                    ].map((col) => (
                      <Card key={col.title} className="border-primary/10">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <col.icon className="h-5 w-5 text-primary" />
                            <h4 className="font-semibold text-foreground text-sm">{col.title}</h4>
                          </div>
                          <ul className="space-y-1.5">
                            {col.items.map((item) => (
                              <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ChevronRight className="h-3 w-3 text-primary/60" /> {item}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════ MANUAL TAB ═══════ */}
        <TabsContent value="manual">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleExportManual} className="gap-2">
                <Download className="h-4 w-4" /> Télécharger le Manuel Complet (PDF)
              </Button>
            </div>

            <div ref={manualRef} className="space-y-2">
              <Card className="mb-6">
                <CardContent className="p-6 text-center space-y-2">
                  <BookOpen className="h-10 w-10 text-primary mx-auto" />
                  <h2 className="text-xl font-bold text-foreground">Manuel d'Utilisation</h2>
                  <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                    Guide complet pour prendre en main la plateforme d'affichage dynamique, de l'installation à l'administration avancée.
                  </p>
                </CardContent>
              </Card>

              <Accordion type="multiple" defaultValue={["installation"]} className="space-y-3">
                {manualSections.map((section) => (
                  <AccordionItem key={section.id} value={section.id} className="border rounded-xl overflow-hidden neon-border">
                    <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow-blue shrink-0">
                          <section.icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-foreground text-sm">{section.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-5">
                      <ol className="space-y-2 mb-4">
                        {section.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                              {i + 1}
                            </span>
                            <span className="pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                      <ManualScreenshot src={section.screenshot} alt={section.screenshotAlt} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
