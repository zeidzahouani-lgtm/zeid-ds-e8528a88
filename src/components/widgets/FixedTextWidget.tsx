interface FixedTextWidgetProps {
  config?: {
    text?: string;
    fontSize?: number;
    textColor?: string;
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
    fontWeight?: string;
    transparentBg?: boolean;
  };
}

export default function FixedTextWidget({ config }: FixedTextWidgetProps) {
  const text = config?.text || "Texte fixe";
  const fontSize = config?.fontSize ?? 24;
  const textColor = config?.textColor || "#ffffff";
  const backgroundColor = config?.backgroundColor || "transparent";
  const textAlign = config?.textAlign || "center";
  const fontWeight = config?.fontWeight || "bold";

  return (
    <div
      className="flex items-center justify-center h-full w-full p-4"
      style={{ backgroundColor: config?.transparentBg ? 'transparent' : backgroundColor, textAlign: textAlign as any }}
    >
      <p style={{ fontSize: `${fontSize}px`, color: textColor, fontWeight }}>{text}</p>
    </div>
  );
}
