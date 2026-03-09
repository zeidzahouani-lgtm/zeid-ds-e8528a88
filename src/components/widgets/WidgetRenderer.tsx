import ClockWidget from "./ClockWidget";
import WeatherWidget from "./WeatherWidget";
import MarqueeWidget from "./MarqueeWidget";

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
    default:
      return (
        <div className="flex items-center justify-center h-full w-full bg-muted text-muted-foreground text-xs">
          Widget inconnu: {widgetType}
        </div>
      );
  }
}
