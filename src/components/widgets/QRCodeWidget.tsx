import { QRCodeSVG } from "qrcode.react";

export type QRCodeType = "url" | "location" | "contact" | "wifi" | "email" | "phone" | "text";

export const QR_CODE_TYPES: { value: QRCodeType; label: string; description: string }[] = [
  { value: "url", label: "Site web", description: "Lien vers un site web" },
  { value: "location", label: "Localisation", description: "Position GPS sur la carte" },
  { value: "contact", label: "Contact (vCard)", description: "Carte de visite numérique" },
  { value: "wifi", label: "WiFi", description: "Connexion WiFi automatique" },
  { value: "email", label: "Email", description: "Envoyer un email" },
  { value: "phone", label: "Téléphone", description: "Appeler un numéro" },
  { value: "text", label: "Texte libre", description: "Texte personnalisé" },
];

interface QRCodeWidgetProps {
  config?: {
    qrType?: QRCodeType;
    url?: string;
    label?: string;
    bgColor?: string;
    fgColor?: string;
    // Location
    latitude?: string;
    longitude?: string;
    // Contact (vCard)
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    contactOrg?: string;
    // WiFi
    wifiSsid?: string;
    wifiPassword?: string;
    wifiEncryption?: "WPA" | "WEP" | "nopass";
    // Email
    emailAddress?: string;
    emailSubject?: string;
    // Phone
    phoneNumber?: string;
    // Text
    freeText?: string;
    transparentBg?: boolean;
  };
}

function buildQRValue(config: QRCodeWidgetProps["config"]): string {
  const type = config?.qrType || "url";

  switch (type) {
    case "url":
      return config?.url || "https://example.com";

    case "location": {
      const lat = config?.latitude || "0";
      const lng = config?.longitude || "0";
      return `geo:${lat},${lng}`;
    }

    case "contact": {
      const name = config?.contactName || "";
      const phone = config?.contactPhone || "";
      const email = config?.contactEmail || "";
      const org = config?.contactOrg || "";
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${name}`,
        org ? `ORG:${org}` : "",
        phone ? `TEL:${phone}` : "",
        email ? `EMAIL:${email}` : "",
        "END:VCARD",
      ].filter(Boolean).join("\n");
    }

    case "wifi": {
      const ssid = config?.wifiSsid || "";
      const pass = config?.wifiPassword || "";
      const enc = config?.wifiEncryption || "WPA";
      return `WIFI:T:${enc};S:${ssid};P:${pass};;`;
    }

    case "email": {
      const addr = config?.emailAddress || "";
      const subject = config?.emailSubject || "";
      return `mailto:${addr}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
    }

    case "phone":
      return `tel:${config?.phoneNumber || ""}`;

    case "text":
      return config?.freeText || "Hello";

    default:
      return config?.url || "https://example.com";
  }
}

export default function QRCodeWidget({ config }: QRCodeWidgetProps) {
  const label = config?.label || "";
  const bgColor = config?.bgColor || "#ffffff";
  const fgColor = config?.fgColor || "#000000";
  const value = buildQRValue(config);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4" style={{ backgroundColor: config?.transparentBg ? 'transparent' : bgColor }}>
      <QRCodeSVG value={value} size={128} bgColor={bgColor} fgColor={fgColor} className="max-w-full max-h-[80%]" />
      {label && <p className="text-xs mt-2 font-medium text-center" style={{ color: fgColor }}>{label}</p>}
    </div>
  );
}
