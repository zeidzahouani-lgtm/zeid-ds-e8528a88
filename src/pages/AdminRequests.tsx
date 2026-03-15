import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ClipboardList, KeyRound, Shield, Check, X, RefreshCw, Copy, Eye, EyeOff, UserPlus, Building2, Monitor } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// Password generator
function generatePassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%&*?";
  const all = upper + lower + digits + special;
  let pw = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  for (let i = pw.length; i < length; i++) {
    pw.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pw.sort(() => Math.random() - 0.5).join("");
}

interface PasswordResetRequest {
  id: string;
  email: string;
  status: string;
  created_at: string;
  handled_by: string | null;
  handled_at: string | null;
}

interface RegistrationRequest {
  id: string;
  email: string;
  display_name: string;
  establishment_name: string;
  num_screens: number;
  phone: string | null;
  address: string | null;
  message: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export default function AdminRequests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Admin check
  const { data: currentUserRoles = [] } = useQuery({
    queryKey: ["my_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user?.id || "");
      return data?.map((r) => r.role) || [];
    },
    enabled: !!user,
  });
  const isAdmin = currentUserRoles.includes("admin");

  // Password reset requests
  const { data: resetRequests = [] } = useQuery({
    queryKey: ["password_reset_requests"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("password_reset_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PasswordResetRequest[];
    },
  });

  // Registration requests
  const { data: regRequests = [] } = useQuery({
    queryKey: ["registration_requests"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RegistrationRequest[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch1 = supabase
      .channel("reset-requests-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "password_reset_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["password_reset_requests"] });
      })
      .subscribe();
    const ch2 = supabase
      .channel("reg-requests-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "registration_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["registration_requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [queryClient]);

  // State for password reset dialog
  const [resetDialog, setResetDialog] = useState<PasswordResetRequest | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // State for registration review dialog
  const [regDialog, setRegDialog] = useState<RegistrationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const openResetDialog = (req: PasswordResetRequest) => {
    setNewPassword(generatePassword());
    setShowPassword(false);
    setResetDialog(req);
  };

  const openRegDialog = (req: RegistrationRequest) => {
    setRegPassword(generatePassword());
    setShowRegPassword(false);
    setRejectionReason("");
    setRegDialog(req);
  };

  // Handle password reset
  const handleResetPassword = useMutation({
    mutationFn: async () => {
      if (!resetDialog) return;
      // Find the user profile by email
      const { data: profiles } = await supabase.from("profiles").select("id").eq("email", resetDialog.email).limit(1);
      if (!profiles || profiles.length === 0) throw new Error("Utilisateur introuvable avec cet email");

      // Use the invite-user edge function with the service role to update password
      const res = await supabase.functions.invoke("invite-user", {
        body: { email: resetDialog.email, password: newPassword, display_name: null, update_password: true },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      // Mark request as handled
      await supabase
        .from("password_reset_requests" as any)
        .update({ status: "handled", handled_by: user?.id, handled_at: new Date().toISOString() } as any)
        .eq("id", resetDialog.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["password_reset_requests"] });
      toast({ title: "Mot de passe mis à jour", description: `Nouveau mot de passe attribué pour ${resetDialog?.email}` });
      setResetDialog(null);
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Handle registration approval
  const handleApproveRegistration = useMutation({
    mutationFn: async () => {
      if (!regDialog) return;
      // Create user via invite-user
      const res = await supabase.functions.invoke("invite-user", {
        body: { email: regDialog.email, password: regPassword, display_name: regDialog.display_name },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);

      // Create establishment
      const { data: est, error: estError } = await supabase.from("establishments").insert({
        name: regDialog.establishment_name,
        max_screens: regDialog.num_screens,
        created_by: user!.id,
        phone: regDialog.phone,
        address: regDialog.address,
      }).select().single();
      if (estError) throw estError;

      // Assign user to establishment
      if (res.data?.user?.id && est) {
        await supabase.from("user_establishments").insert({
          user_id: res.data.user.id,
          establishment_id: est.id,
          role: "admin",
        });
      }

      // Update request status
      await supabase
        .from("registration_requests" as any)
        .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any)
        .eq("id", regDialog.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration_requests"] });
      toast({ title: "Inscription approuvée", description: `Compte et établissement créés pour ${regDialog?.email}` });
      setRegDialog(null);
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // Handle registration rejection
  const handleRejectRegistration = useMutation({
    mutationFn: async () => {
      if (!regDialog) return;
      await supabase
        .from("registration_requests" as any)
        .update({
          status: "rejected",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        } as any)
        .eq("id", regDialog.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration_requests"] });
      toast({ title: "Inscription refusée" });
      setRegDialog(null);
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié dans le presse-papier" });
  };

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">En attente</Badge>;
    if (status === "handled" || status === "approved") return <Badge variant="outline" className="text-green-500 border-green-500/30">Traité</Badge>;
    if (status === "rejected") return <Badge variant="destructive">Refusé</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">Accès refusé</p>
      </div>
    );
  }

  const pendingResets = resetRequests.filter((r) => r.status === "pending").length;
  const pendingRegs = regRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Demandes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gérez les demandes d'inscription et de réinitialisation de mot de passe</p>
      </div>

      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations" className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Inscriptions
            {pendingRegs > 0 && <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{pendingRegs}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resets" className="gap-1.5">
            <KeyRound className="h-4 w-4" /> Mots de passe
            {pendingResets > 0 && <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{pendingResets}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Registration requests */}
        <TabsContent value="registrations" className="space-y-3 mt-4">
          {regRequests.length === 0 && <p className="text-muted-foreground text-sm">Aucune demande d'inscription.</p>}
          {regRequests.map((req) => (
            <Card key={req.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{req.display_name}</p>
                    <p className="text-xs text-muted-foreground">{req.email}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {req.establishment_name}
                      <Monitor className="h-3 w-3 ml-2" /> {req.num_screens} écran(s)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  {statusBadge(req.status)}
                  {req.status === "pending" && (
                    <Button size="sm" onClick={() => openRegDialog(req)}>Examiner</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Password reset requests */}
        <TabsContent value="resets" className="space-y-3 mt-4">
          {resetRequests.length === 0 && <p className="text-muted-foreground text-sm">Aucune demande de réinitialisation.</p>}
          {resetRequests.map((req) => (
            <Card key={req.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{req.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(req.status)}
                  {req.status === "pending" && (
                    <Button size="sm" onClick={() => openResetDialog(req)}>Traiter</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Password reset dialog */}
      <Dialog open={!!resetDialog} onOpenChange={() => setResetDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>{resetDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nouveau mot de passe</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={() => setNewPassword(generatePassword())} title="Générer">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(newPassword)} title="Copier">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(null)}>Annuler</Button>
            <Button onClick={() => handleResetPassword.mutate()} disabled={!newPassword || handleResetPassword.isPending}>
              {handleResetPassword.isPending ? "Mise à jour..." : "Appliquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registration review dialog */}
      <Dialog open={!!regDialog} onOpenChange={() => setRegDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Examiner la demande d'inscription</DialogTitle>
            <DialogDescription>Vérifiez les informations et prenez une décision</DialogDescription>
          </DialogHeader>
          {regDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Nom</p>
                  <p className="font-medium">{regDialog.display_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="font-medium">{regDialog.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Établissement</p>
                  <p className="font-medium">{regDialog.establishment_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Nombre d'écrans</p>
                  <p className="font-medium">{regDialog.num_screens}</p>
                </div>
                {regDialog.phone && (
                  <div>
                    <p className="text-muted-foreground text-xs">Téléphone</p>
                    <p className="font-medium">{regDialog.phone}</p>
                  </div>
                )}
                {regDialog.address && (
                  <div>
                    <p className="text-muted-foreground text-xs">Adresse</p>
                    <p className="font-medium">{regDialog.address}</p>
                  </div>
                )}
              </div>
              {regDialog.message && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Message</p>
                  <p className="text-sm bg-secondary/50 rounded-md p-3">{regDialog.message}</p>
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-sm font-medium text-green-500">Approuver — Mot de passe généré :</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-0 h-full"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                    >
                      {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setRegPassword(generatePassword())}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(regPassword)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Ou refuser :</p>
                <Textarea
                  placeholder="Raison du refus (optionnel)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRegDialog(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => handleRejectRegistration.mutate()}
              disabled={handleRejectRegistration.isPending}
            >
              <X className="h-4 w-4 mr-1" /> Refuser
            </Button>
            <Button
              onClick={() => handleApproveRegistration.mutate()}
              disabled={!regPassword || handleApproveRegistration.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              {handleApproveRegistration.isPending ? "Création..." : "Approuver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
