import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Tv, Image, Clock, LayoutGrid, Sparkles, Settings, Mail,
  BookOpen, Rocket, Eye, ArrowLeft, Download
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRef } from "react";
import { AnimatedBackground } from "@/components/AnimatedBackground";

import screenshotLogin from "@/assets/screenshots/login-screen.png";
import screenshotScreens from "@/assets/screenshots/screens-management.png";
import screenshotMedia from "@/assets/screenshots/media-library.png";
import screenshotLayout from "@/assets/screenshots/layout-editor.png";
import screenshotSchedule from "@/assets/screenshots/schedule-view.png";
import screenshotAI from "@/assets/screenshots/ai-assistant.png";
import screenshotAutoflow from "@/assets/screenshots/autoflow-email.png";
import screenshotAdmin from "@/assets/screenshots/admin-panel.png";

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
  const ratio = pdfW / canvas.width;
  let heightLeft = canvas.height * ratio;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, pdfW, canvas.height * ratio);
  heightLeft -= pdfH;
  while (heightLeft > 0) {
    position -= pdfH;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pdfW, canvas.height * ratio);
    heightLeft -= pdfH;
  }
  pdf.save(filename);
}

const sections = [
  { id: "installation", title: "1. Installation & Premier Démarrage", icon: Rocket, screenshot: screenshotLogin, screenshotAlt: "Écran de connexion", steps: ["Accédez à la plateforme via votre navigateur web.", "Créez votre compte ou contactez votre administrateur.", "Vérifiez votre email et connectez-vous.", "Vous serez guidé vers le tableau de bord principal."] },
  { id: "screens", title: "2. Configuration des Écrans", icon: Tv, screenshot: screenshotScreens, screenshotAlt: "Gestion des écrans", steps: ["Naviguez vers 'Écrans' dans le menu latéral.", "Cliquez sur 'Ajouter un écran' et configurez-le.", "Récupérez l'URL Player unique.", "Ouvrez l'URL sur votre écran physique.", "L'écran apparaîtra comme 'En ligne'."] },
  { id: "content", title: "3. Gestion du Contenu", icon: Image, screenshot: screenshotMedia, screenshotAlt: "Bibliothèque de médias", steps: ["Accédez à la 'Bibliothèque'.", "Glissez-déposez vos fichiers ou uploadez.", "Définissez la durée d'affichage.", "Organisez en playlists.", "Réorganisez par glisser-déposer."] },
  { id: "layouts", title: "4. Création de Layouts", icon: LayoutGrid, screenshot: screenshotLayout, screenshotAlt: "Éditeur de layout", steps: ["Ouvrez 'Layouts' et créez un nouveau.", "Définissez des zones d'affichage.", "Ajoutez des widgets.", "Assignez des médias.", "Sauvegardez et assignez aux écrans."] },
  { id: "schedules", title: "5. Programmation", icon: Clock, screenshot: screenshotSchedule, screenshotAlt: "Programmation horaire", steps: ["Créez des plages horaires.", "Sélectionnez l'écran et le programme.", "Définissez les heures.", "Activez/désactivez selon vos besoins."] },
  { id: "ai", title: "6. Assistant IA", icon: Sparkles, screenshot: screenshotAI, screenshotAlt: "Assistant IA", steps: ["Ouvrez l'Assistant IA.", "Décrivez le contenu souhaité.", "L'IA propose du contenu adapté.", "Publiez directement."] },
  { id: "autoflow", title: "7. Flux Automatique", icon: Mail, screenshot: screenshotAutoflow, screenshotAlt: "Flux email automatique", steps: ["Configurez l'adresse email.", "Envoyez un email avec pièce jointe.", "Le système traite automatiquement.", "Suivez l'historique."] },
  { id: "admin", title: "8. Administration", icon: Settings, screenshot: screenshotAdmin, screenshotAlt: "Panneau d'administration", steps: ["Gérez les utilisateurs et rôles.", "Configurez les établissements.", "Gérez les licences.", "Personnalisez l'apparence."] },
];

export default function PublicManual() {
  const manualRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    if (manualRef.current) exportToPDF(manualRef.current, "Manuel-Utilisation-ZeidDS.pdf");
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Button>
          </Link>
          <Button onClick={handleExport} size="sm" className="gap-1.5">
            <Download className="h-4 w-4" /> Télécharger (PDF)
          </Button>
        </div>

        <div ref={manualRef} className="space-y-4">
          <Card className="border-primary/10">
            <CardContent className="p-8 text-center space-y-3">
              <BookOpen className="h-12 w-12 text-primary mx-auto" />
              <h1 className="text-2xl font-bold gradient-primary-text">Manuel d'Utilisation</h1>
              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                Guide complet pour prendre en main la plateforme d'affichage dynamique.
              </p>
            </CardContent>
          </Card>

          <Accordion type="multiple" defaultValue={["installation"]} className="space-y-3">
            {sections.map((s) => (
              <AccordionItem key={s.id} value={s.id} className="border rounded-xl overflow-hidden neon-border">
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow-blue shrink-0">
                      <s.icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-foreground text-sm">{s.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <ol className="space-y-2 mb-4">
                    {s.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{i + 1}</span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="rounded-xl overflow-hidden border border-primary/20 shadow-glow-blue">
                    <img src={s.screenshot} alt={s.screenshotAlt} className="w-full h-auto object-cover" loading="lazy" />
                    <div className="bg-card/80 px-4 py-2 border-t border-primary/10">
                      <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                        <Eye className="h-3 w-3 text-primary/60" /> {s.screenshotAlt}
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
