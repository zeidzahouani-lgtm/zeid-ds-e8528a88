import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Lock, CheckCircle, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function UploadPage() {
  const { id: screenId } = useParams<{ id: string }>();
  const [step, setStep] = useState<"code" | "upload" | "done">("code");
  const [code, setCode] = useState("");
  const [userName, setUserName] = useState("");
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    try {
      const { data, error } = await (supabase.from("access_codes") as any)
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .eq("is_active", true)
        .single();
      if (error || !data) {
        toast.error("Code d'accès invalide ou désactivé");
      } else {
        setUserName(data.user_name);
        setStep("upload");
        toast.success(`Bienvenue ${data.user_name} !`);
      }
    } catch {
      toast.error("Erreur de vérification");
    } finally {
      setChecking(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !screenId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `screen-${screenId}/${Date.now()}_${userName.replace(/\s+/g, "_")}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("URL introuvable");

      // Create content with 10 min duration
      const now = new Date();
      const endTime = new Date(now.getTime() + 10 * 60 * 1000);

      const { error: contentError } = await (supabase.from("contents") as any).insert({
        image_url: publicUrl,
        title: `Upload de ${userName}`,
        status: "active",
        source: "qr_upload",
        screen_id: screenId,
        start_time: now.toISOString(),
        end_time: endTime.toISOString(),
        sender_email: null,
      });

      if (contentError) throw contentError;

      setStep("done");
      toast.success("Image envoyée ! Elle sera diffusée pendant 10 minutes.");
    } catch (err: any) {
      toast.error("Erreur: " + (err.message || "Upload échoué"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {step === "code" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Accès à l'écran</CardTitle>
              <CardDescription>Entrez votre code d'accès pour diffuser du contenu</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Code d'accès</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Entrez votre code"
                    className="text-center text-lg font-mono tracking-widest"
                    autoFocus
                    maxLength={20}
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={checking || !code.trim()}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {checking ? "Vérification..." : "Valider"}
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {step === "upload" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Envoyer une image</CardTitle>
              <CardDescription>Bonjour {userName} ! Sélectionnez une image à diffuser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {preview ? (
                <div className="relative group">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                  >
                    <span className="text-white text-sm font-medium">Changer l'image</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cliquez pour sélectionner une image</span>
                </button>
              )}

              <p className="text-xs text-muted-foreground text-center">
                L'image sera diffusée pendant 10 minutes sur cet écran.
              </p>

              <Button
                onClick={handleUpload}
                className="w-full gap-2"
                disabled={!file || uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Envoi en cours..." : "Diffuser l'image"}
              </Button>
            </CardContent>
          </>
        )}

        {step === "done" && (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center mb-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle className="text-xl">Image envoyée !</CardTitle>
              <CardDescription>Votre image sera diffusée pendant 10 minutes sur cet écran.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              {preview && (
                <img src={preview} alt="Uploaded" className="w-full h-40 object-cover rounded-lg border border-border mb-4" />
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setPreview(null);
                }}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Envoyer une autre image
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}