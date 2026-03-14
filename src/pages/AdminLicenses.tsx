import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useLicenses } from "@/hooks/useLicenses";
import { useScreens } from "@/hooks/useScreens";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, Shield, ShieldOff, Monitor, Calendar, QrCode, Camera } from "lucide-react";
import QRScanner from "@/components/dashboard/QRScanner";

export default function AdminLicenses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { licenses, isLoading, createLicense, toggleLicense, deleteLicense, assignScreen } = useLicenses();
  const { screens } = useScreens();
  const [durationDays, setDurationDays] = useState("365");
  const [selectedScreen, setSelectedScreen] = useState("");
  const [creating, setCreating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const screenFromQR = searchParams.get("screen");

  // Pre-select screen from QR code scan
  useEffect(() => {
    if (screenFromQR) {
      setSelectedScreen(screenFromQR);
      // Clear the param so it doesn't persist
      searchParams.delete("screen");
      setSearchParams(searchParams, { replace: true });
    }
  }, [screenFromQR]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createLicense.mutateAsync({
        screenId: selectedScreen || undefined,
        durationDays: parseInt(durationDays) || 365,
      });
      toast.success("Licence générée avec succès");
      setSelectedScreen("");
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Clé copiée dans le presse-papiers");
  };

  const isExpired = (validUntil: string) => new Date(validUntil) < new Date();

  return (
    <div className="space-y-6 animate-cyber-in">
      <div>
        <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">Licences</h1>
        <p className="text-muted-foreground text-sm mt-1 normal-case tracking-normal">
          Générez et gérez les licences d'activation des écrans
        </p>
      </div>

      {selectedScreen && selectedScreen !== "none" && screens.find((s: any) => s.id === selectedScreen) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex items-center gap-3">
            <QrCode className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm">
              Écran pré-sélectionné : <span className="font-semibold text-primary">{screens.find((s: any) => s.id === selectedScreen)?.name}</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create license */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4 text-primary icon-neon" />
            Générer une licence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Durée (jours)</Label>
              <Select value={durationDays} onValueChange={setDurationDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 jours</SelectItem>
                  <SelectItem value="90">90 jours</SelectItem>
                  <SelectItem value="180">6 mois</SelectItem>
                  <SelectItem value="365">1 an</SelectItem>
                  <SelectItem value="730">2 ans</SelectItem>
                  <SelectItem value="1825">5 ans</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Écran (optionnel)</Label>
              <Select value={selectedScreen} onValueChange={setSelectedScreen}>
                <SelectTrigger>
                  <SelectValue placeholder="Assigner plus tard" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assigner plus tard</SelectItem>
                  {screens.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
                <Key className="h-4 w-4" />
                {creating ? "Génération..." : "Générer"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Licenses list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-wider">
          Licences existantes
          <Badge variant="secondary" className="ml-2">{licenses.length}</Badge>
        </h2>

        {isLoading ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground normal-case animate-pulse">Chargement...</p>
          </Card>
        ) : licenses.length === 0 ? (
          <Card className="p-8 text-center">
            <Key className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground normal-case">Aucune licence générée</p>
          </Card>
        ) : (
          <div className="space-y-3 stagger-children">
            {licenses.map((license) => {
              const expired = isExpired(license.valid_until);
              const screenName = screens.find((s: any) => s.id === license.screen_id)?.name;

              return (
                <Card key={license.id} className={`p-4 ${expired ? "opacity-60" : ""}`}>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* License key */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        license.is_active && !expired ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                      }`}>
                        {license.is_active && !expired ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-bold tracking-wider">{license.license_key}</code>
                          <button onClick={() => copyKey(license.license_key)} className="text-muted-foreground hover:text-primary transition-colors">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground normal-case">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expire: {new Date(license.valid_until).toLocaleDateString("fr-FR")}
                          </span>
                          {screenName && (
                            <span className="flex items-center gap-1">
                              <Monitor className="h-3 w-3" />
                              {screenName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-2">
                      {expired && (
                        <Badge variant="destructive" className="text-[10px]">Expirée</Badge>
                      )}
                      {!expired && license.is_active && (
                        <Badge className="bg-status-online/20 text-status-online border-status-online/30 text-[10px]">Active</Badge>
                      )}
                      {!license.is_active && (
                        <Badge variant="secondary" className="text-[10px]">Désactivée</Badge>
                      )}
                      {!license.screen_id && (
                        <Badge variant="outline" className="text-[10px]">Non assignée</Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!license.screen_id && (
                        <Select onValueChange={(val) => {
                          if (val) assignScreen.mutate({ id: license.id, screen_id: val });
                        }}>
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Assigner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {screens.map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleLicense.mutate({ id: license.id, is_active: !license.is_active })}
                      >
                        {license.is_active ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteLicense.mutate(license.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
