import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPPORT_DRAVOX_URL = "https://okgmecbjvtmbzuyqwruu.supabase.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPPORT_DRAVOX_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      throw new Error("SUPPORT_DRAVOX_SERVICE_ROLE_KEY is not configured");
    }

    const body = await req.json();
    const {
      display_name,
      email,
      establishment_name,
      num_screens,
      phone,
      address,
      matricule_fiscal,
      registre_commerce,
      code_tva,
      code_categorie,
      secteur_activite,
    } = body;

    // Create Supabase client for support-dravox with service_role to bypass RLS
    const supportSupabase = createClient(SUPPORT_DRAVOX_URL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch app_settings from support-dravox for entreprise info
    const { data: settings } = await supportSupabase
      .from("app_settings")
      .select("nom_societe, logo_url")
      .limit(1)
      .single();

    const entrepriseNom = settings?.nom_societe || "GNSS Solutions";
    const entrepriseLogoUrl = settings?.logo_url || "";

    // Generate devis number
    const now = new Date();
    const prefix = "DEV";
    const numero = `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

    // Build line items based on registration data
    const prixParEcran = 0; // Prix à définir
    const tva = 19;
    const lignes = [
      {
        designation: `Licence affichage dynamique - ${num_screens} écran(s)`,
        quantite: num_screens,
        prix_unitaire_ht: prixParEcran,
        taux_tva: tva,
      },
    ];

    // Calculate totals
    const totalHt = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire_ht, 0);
    const totalTva = Math.round(totalHt * tva / 100 * 1000) / 1000;
    const timbre = 1;
    const totalTtc = Math.round((totalHt + totalTva + timbre) * 1000) / 1000;

    // Build client address with fiscal info
    const clientAdresseLines = [address || ""];
    if (matricule_fiscal) clientAdresseLines.push(`MF: ${matricule_fiscal}`);
    if (registre_commerce) clientAdresseLines.push(`RC: ${registre_commerce}`);
    if (code_tva) clientAdresseLines.push(`TVA: ${code_tva}`);
    if (code_categorie) clientAdresseLines.push(`Cat: ${code_categorie}`);
    const clientAdresse = clientAdresseLines.filter(Boolean).join("\n");

    // Build notes
    const notesParts = [];
    if (secteur_activite) notesParts.push(`Secteur: ${secteur_activite}`);
    notesParts.push(`Demande d'inscription - ${establishment_name}`);
    const notes = notesParts.join(" | ");

    // Insert devis into support-dravox
    const { data: facture, error: factureError } = await supportSupabase
      .from("factures")
      .insert({
        numero,
        type_document: "devis",
        statut: "brouillon",
        style: "moderne",
        client_nom: `${display_name} - ${establishment_name}`,
        client_adresse: clientAdresse,
        client_email: email,
        client_telephone: phone || "",
        entreprise_nom: entrepriseNom,
        entreprise_adresse: "",
        entreprise_logo_url: entrepriseLogoUrl,
        date_document: now.toISOString().split("T")[0],
        notes,
        conditions: "",
        total_ht: totalHt,
        total_tva: totalTva,
        total_ttc: totalTtc,
        timbre_fiscale: timbre,
        mention_legale: "",
      })
      .select("id")
      .single();

    if (factureError) {
      throw new Error(`Failed to create devis: ${factureError.message}`);
    }

    // Insert line items
    const lignesPayload = lignes.map((l, i) => {
      const ht = Math.round(l.quantite * l.prix_unitaire_ht * 1000) / 1000;
      const tvaAmount = Math.round(ht * l.taux_tva / 100 * 1000) / 1000;
      return {
        facture_id: facture.id,
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        taux_tva: l.taux_tva,
        total_ht: ht,
        total_tva: tvaAmount,
        total_ttc: Math.round((ht + tvaAmount) * 1000) / 1000,
        ordre: i,
      };
    });

    const { error: lignesError } = await supportSupabase
      .from("facture_lignes")
      .insert(lignesPayload);

    if (lignesError) {
      throw new Error(`Failed to create devis lines: ${lignesError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, devis_id: facture.id, numero }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error generating devis:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
