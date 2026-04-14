import { useState, useEffect } from "react";
import { Rss, RefreshCw, ExternalLink } from "lucide-react";

interface RSSItem {
  title: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

interface RSSWidgetProps {
  config?: {
    feedUrl?: string;
    maxItems?: number;
    showDescription?: boolean;
    scrollSpeed?: number;
    backgroundColor?: string;
    textColor?: string;
    accentColor?: string;
    transparentBg?: boolean;
  };
}

const RSS_PROXY = "https://api.rss2json.com/v1/api.json";

export default function RSSWidget({ config }: RSSWidgetProps) {
  const feedUrl = config?.feedUrl || "";
  const maxItems = config?.maxItems || 5;
  const showDescription = config?.showDescription ?? false;
  const scrollSpeed = config?.scrollSpeed || 30;
  const bgColor = config?.backgroundColor || "#0f172a";
  const textColor = config?.textColor || "#ffffff";
  const accentColor = config?.accentColor || "#3b82f6";
  const transparentBg = config?.transparentBg ?? false;

  const [items, setItems] = useState<RSSItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedTitle, setFeedTitle] = useState<string>("");

  useEffect(() => {
    if (!feedUrl) {
      setItems([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchFeed = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${RSS_PROXY}?rss_url=${encodeURIComponent(feedUrl)}&count=${maxItems}`);
        if (!res.ok) throw new Error("Fetch failed");
        const data = await res.json();
        if (cancelled) return;
        if (data.status !== "ok") throw new Error(data.message || "Invalid feed");
        setFeedTitle(data.feed?.title || "");
        setItems(
          (data.items || []).slice(0, maxItems).map((item: any) => ({
            title: item.title || "Sans titre",
            link: item.link,
            pubDate: item.pubDate,
            description: item.description?.replace(/<[^>]*>/g, "").slice(0, 120),
          }))
        );
      } catch {
        if (!cancelled) setError("Impossible de charger le flux");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [feedUrl, maxItems]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const totalHeight = items.length * (showDescription ? 80 : 48);
  const animDuration = totalHeight / scrollSpeed;

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{
        backgroundColor: transparentBg ? "transparent" : bgColor,
        color: textColor,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
        style={{ borderBottom: `1px solid ${textColor}15` }}
      >
        <Rss className="h-3.5 w-3.5" style={{ color: accentColor }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {feedTitle || "Flux RSS"}
        </span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin opacity-40 ml-auto" />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {error && (
          <div className="p-3 text-[10px] text-red-400">{error}</div>
        )}

        {!feedUrl && !error && (
          <div className="flex items-center justify-center h-full text-xs opacity-40">
            Configurez l'URL du flux RSS
          </div>
        )}

        {items.length > 0 && (
          <div className="rss-scroll-container" style={{ animation: items.length > 3 ? `rss-scroll ${animDuration}s linear infinite` : "none" }}>
            {[...items, ...(items.length > 3 ? items : [])].map((item, i) => (
              <div
                key={`${item.title}-${i}`}
                className="px-3 py-2"
                style={{ borderBottom: `1px solid ${textColor}08` }}
              >
                <div className="flex items-start gap-1.5">
                  <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-40" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight line-clamp-2">{item.title}</p>
                    {showDescription && item.description && (
                      <p className="text-[10px] opacity-50 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    {item.pubDate && (
                      <span className="text-[9px] opacity-30">{formatDate(item.pubDate)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes rss-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .rss-scroll-container {
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
