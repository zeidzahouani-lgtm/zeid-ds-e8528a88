import { useState } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Palette, Type, Image, Globe, Save, RotateCcw } from "lucide-react";

export default function AdminCustomization() {
  const { settings, updateSetting } = useAppSettings();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  // Sync form when settings load
  useState(() => {
    setForm(settings);
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const keys = Object.keys(form) as (keyof typeof form)[];
      for (const key of keys) {
        if (form[key] !== settings[key]) {
          await updateSetting.mutateAsync({ key, value: form[key] });
        }
      }
      toast.success("Personnalisation sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(settings);
  };

  return (
    <div className="space-y-6 animate-cyber-in">
      <div>
        <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">Personnalisation</h1>
        <p className="text-muted-foreground text-sm mt-1 normal-case tracking-normal">
          Configurez l'apparence de votre application
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Type className="h-4 w-4 text-primary icon-neon" />
              Identité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom de la solution</Label>
              <Input
                value={form.app_name}
                onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                placeholder="SignageOS"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sous-titre</Label>
              <Input
                value={form.app_tagline}
                onChange={(e) => setForm({ ...form, app_tagline: e.target.value })}
                placeholder="Digital Signage CMS"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Titre de la page (onglet navigateur)</Label>
              <Input
                value={form.page_title}
                onChange={(e) => setForm({ ...form, page_title: e.target.value })}
                placeholder="SignageOS — Digital Signage CMS"
              />
            </div>
          </CardContent>
        </Card>

        {/* Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Image className="h-4 w-4 text-accent icon-neon" />
              Visuels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">URL du logo</Label>
              <Input
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              {form.logo_url && (
                <div className="mt-2 p-3 rounded-lg bg-secondary/50 flex items-center justify-center">
                  <img src={form.logo_url} alt="Aperçu logo" className="max-h-16 object-contain" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">URL du favicon</Label>
              <Input
                value={form.favicon_url}
                onChange={(e) => setForm({ ...form, favicon_url: e.target.value })}
                placeholder="https://example.com/favicon.ico"
              />
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Palette className="h-4 w-4 text-neon-pink icon-neon" />
              Couleurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Couleur principale (HSL)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  placeholder="185 100% 55%"
                />
                <div
                  className="h-10 w-10 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: `hsl(${form.primary_color})` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground normal-case">Format : H S% L% (ex: 185 100% 55% pour cyan)</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Couleur d'accent (HSL)</Label>
              <div className="flex gap-2 items-center">
                <Input
                  value={form.accent_color}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  placeholder="270 80% 60%"
                />
                <div
                  className="h-10 w-10 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: `hsl(${form.accent_color})` }}
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-2">
              {[
                { label: "Cyan", value: "185 100% 55%" },
                { label: "Violet", value: "270 80% 60%" },
                { label: "Rose", value: "330 90% 60%" },
                { label: "Vert", value: "160 100% 45%" },
                { label: "Orange", value: "25 95% 55%" },
                { label: "Bleu", value: "220 90% 55%" },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setForm({ ...form, primary_color: preset.value })}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary text-xs transition-colors normal-case"
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: `hsl(${preset.value})` }} />
                  {preset.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Welcome */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-primary icon-neon" />
              Page de connexion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message de bienvenue</Label>
              <Textarea
                value={form.welcome_message}
                onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
                placeholder="Connectez-vous à votre tableau de bord"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Réinitialiser
        </Button>
      </div>
    </div>
  );
}
