import { QRCodeSVG } from "qrcode.react";

interface QRCodeWidgetProps {
  config?: {
    url?: string;
    label?: string;
    bgColor?: string;
    fgColor?: string;
  };
}

export default function QRCodeWidget({ config }: QRCodeWidgetProps) {
  const url = config?.url || "https://example.com";
  const label = config?.label || "";
  const bgColor = config?.bgColor || "#ffffff";
  const fgColor = config?.fgColor || "#000000";

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-4" style={{ backgroundColor: bgColor }}>
      <QRCodeSVG value={url} size={128} bgColor={bgColor} fgColor={fgColor} className="max-w-full max-h-[80%]" />
      {label && <p className="text-xs mt-2 font-medium text-center" style={{ color: fgColor }}>{label}</p>}
    </div>
  );
}
