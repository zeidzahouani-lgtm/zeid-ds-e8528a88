import ClockWidget from "./ClockWidget";
import WeatherWidget from "./WeatherWidget";
import MarqueeWidget from "./MarqueeWidget";
import QRCodeWidget from "./QRCodeWidget";
import FixedTextWidget from "./FixedTextWidget";
import CurrencyWidget from "./CurrencyWidget";
import RSSWidget from "./RSSWidget";
import SlideshowWidget from "./SlideshowWidget";

interface WidgetRendererProps {
  widgetType: string;
  widgetConfig?: Record<string, any>;
}

export default function WidgetRenderer({ widgetType, widgetConfig }: WidgetRendererProps) {
  switch (widgetType) {
    case "clock":
      return <ClockWidget config={widgetConfig} />;
    case "weather":
      return <WeatherWidget config={widgetConfig} />;
    case "marquee":
      return <MarqueeWidget config={widgetConfig} />;
    case "qrcode":
      return <QRCodeWidget config={widgetConfig} />;
    case "fixedtext":
      return <FixedTextWidget config={widgetConfig} />;
    case "currency":
      return <CurrencyWidget config={widgetConfig} />;
    case "rss":
      return <RSSWidget config={widgetConfig} />;
    case "slideshow":
      return <SlideshowWidget config={widgetConfig} />;
    default:
      return (
        <div className="flex items-center justify-center h-full w-full bg-muted text-muted-foreground text-xs">
          Widget inconnu: {widgetType}
        </div>
      );
  }
}
