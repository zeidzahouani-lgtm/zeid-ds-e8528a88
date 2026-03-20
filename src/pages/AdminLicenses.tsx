import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLicenses } from "@/hooks/useLicenses";
import { useScreens } from "@/hooks/useScreens";
import { useEstablishments } from "@/hooks/useEstablishments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Key, Plus, Trash2, Copy, Shield, ShieldOff, Monitor, Calendar, QrCode, Camera, RefreshCw, Building2, Sparkles, Wrench } from "lucide-react";
import QRScanner from "@/components/dashboard/QRScanner";

export default function AdminLicenses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { licenses, isLoading, createLicense, toggleLicense, deleteLicense, assignScreen, renewLicense } = useLicenses();
  const { screens } = useScreens();
  const { establishments } = useEstablishments();
  const [durationDays, setDurationDays] = useState("365");
  const [selectedScreen, setSelectedScreen] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] = useState("");
  const [creating, setCreating] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [renewDays, setRenewDays] = useState("365");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const screenFromQR = searchParams.get("screen");

  // Pre-select screen from QR code scan
  useEffect(() => {
    if (screenFromQR) {
      setSelectedScreen(screenFromQR);
      searchParams.delete("screen");
      setSearchParams(searchParams, { replace: true });
    }
  }, [screenFromQR]);

  // Filter screens by selected establishment for creation form
  const filteredScreensForCreate = useMemo(() => {
    if (!selectedEstablishment || selectedEstablishment === "none") return screens;
    return screens.filter((s: any) => s.establishment_id === selectedEstablishment);
  }, [screens, selectedEstablishment]);

  // Reset screen selection when establishment changes
  useEffect(() => {
    if (selectedEstablishment && selectedScreen) {
      const screenExists = filteredScreensForCreate.find((s: any) => s.id === selectedScreen);
      if (!screenExists) setSelectedScreen("");
    }
  }, [selectedEstablishment, filteredScreensForCreate]);

  // Get screens filtered by a license's establishment
  const getScreensForLicense = (license: any) => {
    if (!license.establishment_id) return screens;
    return screens.filter((s: any) => s.establishment_id === license.establishment_id);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createLicense.mutateAsync({
        screenId: selectedScreen && selectedScreen !== "none" ? selectedScreen : undefined,
        durationDays: parseInt(durationDays) || 365,
        establishmentId: selectedEstablishment && selectedEstablishment !== "none" ? selectedEstablishment : undefined,
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

      <QRScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(screenId) => {
          const screenName = screens.find((s: any) => s.id === screenId)?.name;
          toast.success(screenName ? `Écran détecté : ${screenName}` : "Écran détecté");
          navigate(`/assign-license/${screenId}`);
        }}
      />

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Établissement</Label>
              <Select value={selectedEstablishment} onValueChange={setSelectedEstablishment}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les établissements" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (global)</SelectItem>
                  {(establishments || []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3 w-3" />
                        {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  {filteredScreensForCreate.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setScannerOpen(true)} className="gap-2 shrink-0">
                <Camera className="h-4 w-4" />
                Scanner
              </Button>
              <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
                <Key className="h-4 w-4" />
                {creating ? "Génération..." : "Générer"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Licenses list with tabs */}
      <div className="space-y-3">
        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-wider">
              Licences existantes
              <Badge variant="secondary" className="ml-2">{licenses.length}</Badge>
            </h2>
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5 text-xs">
                Toutes
                <Badge variant="secondary" className="text-[10px] ml-1">{licenses.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1.5 text-xs">
                <Wrench className="h-3 w-3" />
                Manuelles
                <Badge variant="secondary" className="text-[10px] ml-1">{licenses.filter(l => l.source !== 'auto').length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="auto" className="gap-1.5 text-xs">
                <Sparkles className="h-3 w-3" />
                Auto
                <Badge variant="secondary" className="text-[10px] ml-1">{licenses.filter(l => l.source === 'auto').length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {["all", "manual", "auto"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-3">
              {isLoading ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground normal-case animate-pulse">Chargement...</p>
                </Card>
              ) : (() => {
                const filtered = tab === "all" ? licenses
                  : tab === "auto" ? licenses.filter(l => l.source === 'auto')
                  : licenses.filter(l => l.source !== 'auto');

                return filtered.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Key className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground normal-case">Aucune licence {tab === 'auto' ? 'automatique' : tab === 'manual' ? 'manuelle' : ''}</p>
                  </Card>
                ) : (
                  <div className="space-y-3 stagger-children">
                    {filtered.map((license) => {
                      const expired = isExpired(license.valid_until);
                      const screenName = screens.find((s: any) => s.id === license.screen_id)?.name;
                      const assignableScreens = getScreensForLicense(license);

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
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground normal-case flex-wrap">
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
                                  {license.establishment_name && (
                                    <Badge variant="outline" className="text-[10px] gap-1">
                                      <Building2 className="h-2.5 w-2.5" />
                                      {license.establishment_name}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {license.source === 'auto' ? (
                                <Badge variant="outline" className="text-[10px] gap-1 border-accent text-accent-foreground">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  Auto
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] gap-1">
                                  <Wrench className="h-2.5 w-2.5" />
                                  Manuelle
                                </Badge>
                              )}
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
                              {expired && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                                  onClick={() => { setRenewingId(license.id); setRenewDays("365"); }}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  Renouveler
                                </Button>
                              )}
                              {!license.screen_id && (
                                <Select onValueChange={(val) => {
                                  if (val) assignScreen.mutate({ id: license.id, screen_id: val });
                                }}>
                                  <SelectTrigger className="w-[140px] h-8 text-xs">
                                    <SelectValue placeholder="Assigner..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {assignableScreens.length === 0 ? (
                                      <SelectItem value="__empty" disabled>Aucun écran disponible</SelectItem>
                                    ) : (
                                      assignableScreens.map((s: any) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                      ))
                                    )}
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
                                onClick={() => setDeletingId(license.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Renew dialog */}
      <Dialog open={!!renewingId} onOpenChange={(open) => !open && setRenewingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Renouveler la licence
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nouvelle durée</Label>
            <Select value={renewDays} onValueChange={setRenewDays}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewingId(null)}>Annuler</Button>
            <Button
              onClick={async () => {
                if (!renewingId) return;
                try {
                  await renewLicense.mutateAsync({ id: renewingId, durationDays: parseInt(renewDays) });
                  toast.success("Licence renouvelée avec succès");
                  setRenewingId(null);
                } catch {
                  toast.error("Erreur lors du renouvellement");
                }
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Renouveler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette licence ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La licence sera définitivement supprimée et l'écran associé ne pourra plus l'utiliser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingId) {
                  deleteLicense.mutate(deletingId);
                  toast.success("Licence supprimée");
                  setDeletingId(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
