import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, Upload, Trash2, Image, Type, Palette, LayoutDashboard, MonitorPlay } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BrandingTabProps {
  getSetting: (key: string) => string | null;
  saveMultiple: (pairs: { key: string; value: string }[]) => Promise<void>;
  settings: any[];
}

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter (Défaut)" },
  { value: "Roboto", label: "Roboto" },
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Raleway", label: "Raleway" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Source Sans Pro", label: "Source Sans Pro" },
  { value: "Nunito", label: "Nunito" },
];

export default function BrandingTab({ getSetting, saveMultiple, settings }: BrandingTabProps) {
  const [brandName, setBrandName] = useState(getSetting("brand_name") || "");
  const [brandColor, setBrandColor] = useState(getSetting("brand_color") || "#00d4ff");
  const [accentColor, setAccentColor] = useState(getSetting("brand_accent_color") || "#a855f7");
  const [bgColor, setBgColor] = useState(getSetting("brand_bg_color") || "#050505");
  const [textColor, setTextColor] = useState(getSetting("brand_text_color") || "#ffffff");
  const [fontFamily, setFontFamily] = useState(getSetting("brand_font") || "Inter");
  const [logoUrl, setLogoUrl] = useState(getSetting("brand_logo_url") || "");
  const [faviconUrl, setFaviconUrl] = useState(getSetting("brand_favicon_url") || "");
  const [welcomeMsg, setWelcomeMsg] = useState(getSetting("brand_welcome_message") || "");
  const [footerText, setFooterText] = useState(getSetting("brand_footer_text") || "");
  const [playerWatermark, setPlayerWatermark] = useState(getSetting("brand_player_watermark") || "");
  const [showLogoOnPlayer, setShowLogoOnPlayer] = useState(getSetting("brand_show_logo_player") !== "false");
  const [playerBgColor, setPlayerBgColor] = useState(getSetting("brand_player_bg_color") || "#000000");
  const [sidebarStyle, setSidebarStyle] = useState(getSetting("brand_sidebar_style") || "dark");
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File, type: "logo" | "favicon") => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `branding/establishments/${Date.now()}_${type}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      if (type === "logo") setLogoUrl(data.publicUrl);
      else setFaviconUrl(data.publicUrl);
      toast({ title: `${type === "logo" ? "Logo" : "Favicon"} uploadé` });
    } catch {
      toast({ title: "Erreur d'upload", variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSave = () => {
    saveMultiple([
      { key: "brand_name", value: brandName },
      { key: "brand_color", value: brandColor },
      { key: "brand_accent_color", value: accentColor },
      { key: "brand_bg_color", value: bgColor },
      { key: "brand_text_color", value: textColor },
      { key: "brand_font", value: fontFamily },
      { key: "brand_logo_url", value: logoUrl },
      { key: "brand_favicon_url", value: faviconUrl },
      { key: "brand_welcome_message", value: welcomeMsg },
      { key: "brand_footer_text", value: footerText },
      { key: "brand_player_watermark", value: playerWatermark },
      { key: "brand_show_logo_player", value: showLogoOnPlayer ? "true" : "false" },
      { key: "brand_player_bg_color", value: playerBgColor },
      { key: "brand_sidebar_style", value: sidebarStyle },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" /> Identité
          </CardTitle>
          <CardDescription>Nom, logo et favicon de l'établissement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nom affiché</Label>
            <Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Mon Établissement" className="mt-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Logo</Label>
              <div className="mt-1 flex items-center gap-3">
                {logoUrl ? (
                  <div className="relative">
                    <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded border border-border bg-secondary/30 p-1" />
                    <Button size="icon" variant="ghost" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => setLogoUrl("")}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded border border-dashed border-border flex items-center justify-center bg-secondary/20">
                    <Image className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span><Upload className="h-3 w-3 mr-1" /> {uploading ? "..." : "Uploader"}</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "logo")} />
                </label>
              </div>
            </div>
            <div>
              <Label>Favicon</Label>
              <div className="mt-1 flex items-center gap-3">
                {faviconUrl ? (
                  <div className="relative">
                    <img src={faviconUrl} alt="Favicon" className="h-10 w-10 object-contain rounded border border-border bg-secondary/30 p-1" />
                    <Button size="icon" variant="ghost" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => setFaviconUrl("")}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded border border-dashed border-border flex items-center justify-center bg-secondary/20">
                    <Image className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span><Upload className="h-3 w-3 mr-1" /> {uploading ? "..." : "Uploader"}</span>
                  </Button>
                  <input type="file" accept="image/*,.ico" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], "favicon")} />
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Couleurs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Couleurs
          </CardTitle>
          <CardDescription>Personnalisez les couleurs de l'interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Couleur principale", value: brandColor, setter: setBrandColor },
              { label: "Couleur d'accent", value: accentColor, setter: setAccentColor },
              { label: "Fond de page", value: bgColor, setter: setBgColor },
              { label: "Couleur du texte", value: textColor, setter: setTextColor },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <Label className="text-xs">{label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={value} onChange={e => setter(e.target.value)} className="w-9 h-9 rounded border border-border cursor-pointer shrink-0" />
                  <Input value={value} onChange={e => setter(e.target.value)} className="text-xs h-9" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Typographie & Style */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-primary" /> Typographie & Interface
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Police de caractères</Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Style de la sidebar</Label>
              <Select value={sidebarStyle} onValueChange={setSidebarStyle}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Sombre</SelectItem>
                  <SelectItem value="light">Clair</SelectItem>
                  <SelectItem value="glass">Glassmorphism</SelectItem>
                  <SelectItem value="colored">Couleur principale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Message d'accueil (dashboard)</Label>
            <Textarea value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} placeholder="Bienvenue sur votre tableau de bord" className="mt-1" rows={2} />
          </div>
          <div>
            <Label>Texte de pied de page</Label>
            <Input value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="© 2026 Mon Entreprise" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Player */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MonitorPlay className="h-4 w-4 text-primary" /> Apparence du Player
          </CardTitle>
          <CardDescription>Personnalisez ce que vos écrans affichent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Afficher le logo sur le player</Label>
            <Switch checked={showLogoOnPlayer} onCheckedChange={setShowLogoOnPlayer} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Couleur de fond du player</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={playerBgColor} onChange={e => setPlayerBgColor(e.target.value)} className="w-9 h-9 rounded border border-border cursor-pointer shrink-0" />
                <Input value={playerBgColor} onChange={e => setPlayerBgColor(e.target.value)} className="text-xs h-9" />
              </div>
            </div>
            <div>
              <Label>Texte watermark</Label>
              <Input value={playerWatermark} onChange={e => setPlayerWatermark(e.target.value)} placeholder="Powered by..." className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aperçu</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="rounded-lg border border-border p-6 transition-all"
            style={{ backgroundColor: bgColor, color: textColor, fontFamily }}
          >
            <div className="flex items-center gap-3 mb-4">
              {logoUrl && <img src={logoUrl} alt="Preview" className="h-8 object-contain" />}
              <span className="font-bold text-lg" style={{ color: brandColor }}>{brandName || "Mon Établissement"}</span>
            </div>
            <p className="text-sm opacity-80 mb-3">{welcomeMsg || "Message d'accueil personnalisé"}</p>
            <div className="flex gap-2">
              <div className="rounded px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: brandColor }}>Bouton principal</div>
              <div className="rounded px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: accentColor }}>Bouton accent</div>
            </div>
            {footerText && <p className="text-xs opacity-50 mt-4 border-t border-white/10 pt-2">{footerText}</p>}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        <Save className="h-4 w-4 mr-2" /> Sauvegarder tout le branding
      </Button>
    </div>
  );
}
