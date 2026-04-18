import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SlideshowItem {
  url: string;
  type?: "image" | "video" | string;
  /** durée en secondes pour cette image */
  duration?: number;
}

export interface SlideshowConfig {
  /** Liste statique d'images (chaque item peut avoir sa propre durée) */
  items?: SlideshowItem[];
  /** Si défini, on charge dynamiquement les médias de cette playlist */
  playlistId?: string | null;
  /** Durée par défaut (en secondes) si l'item n'en spécifie pas */
  defaultDuration?: number;
  /** Effet de transition entre les images */
  transition?: "fade" | "slide" | "none";
  /** Vitesse de transition en ms */
  transitionDuration?: number;
  /** Mode d'ajustement de l'image */
  fit?: "cover" | "contain";
  /** Couleur de fond derrière l'image (utile en mode contain) */
  backgroundColor?: string;
}

interface Props {
  config?: SlideshowConfig;
}

export default function SlideshowWidget({ config }: Props) {
  const {
    items: staticItems = [],
    playlistId,
    defaultDuration = 5,
    transition = "fade",
    transitionDuration = 600,
    fit = "cover",
    backgroundColor = "#000000",
  } = config || {};

  const [playlistItems, setPlaylistItems] = useState<SlideshowItem[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  // Charge les items de la playlist si fournie
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!playlistId) {
        setPlaylistItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("playlist_items")
        .select("position, duration, media:media_id(url, type)")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true });
      if (cancelled || error || !data) return;
      const mapped: SlideshowItem[] = data
        .map((row: any) => ({
          url: row.media?.url,
          type: row.media?.type,
          duration: row.duration ?? undefined,
        }))
        .filter((it) => !!it.url);
      setPlaylistItems(mapped);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  const items = useMemo<SlideshowItem[]>(() => {
    if (playlistId) return playlistItems;
    return staticItems;
  }, [playlistId, playlistItems, staticItems]);

  // Reset index si la liste rétrécit
  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  // Boucle de défilement
  useEffect(() => {
    if (items.length === 0) return;
    const current = items[index];
    const dur = (current?.duration ?? defaultDuration) * 1000;

    if (timerRef.current) window.clearTimeout(timerRef.current);

    if (transition === "fade") {
      // visible -> hide -> next -> visible
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        window.setTimeout(() => {
          setIndex((i) => (i + 1) % items.length);
          setVisible(true);
        }, transitionDuration);
      }, dur);
    } else {
      timerRef.current = window.setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
      }, dur);
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, items, defaultDuration, transition, transitionDuration]);

  if (items.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-xs"
        style={{ backgroundColor, color: "rgba(255,255,255,0.6)" }}
      >
        Diaporama vide — ajoutez des images
      </div>
    );
  }

  // Mode SLIDE : on rend toutes les images en track translatée
  if (transition === "slide") {
    return (
      <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor }}>
        <div
          className="flex h-full"
          style={{
            width: `${items.length * 100}%`,
            transform: `translateX(-${(index * 100) / items.length}%)`,
            transition: `transform ${transitionDuration}ms ease-in-out`,
          }}
        >
          {items.map((it, i) => (
            <div
              key={i}
              className="h-full flex items-center justify-center"
              style={{ width: `${100 / items.length}%` }}
            >
              {it.type?.startsWith("video") ? (
                <video
                  src={it.url}
                  className="w-full h-full"
                  style={{ objectFit: fit }}
                  muted
                  autoPlay
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={it.url}
                  alt=""
                  className="w-full h-full"
                  style={{ objectFit: fit }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Mode FADE ou NONE
  const current = items[index];
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor }}>
      <div
        key={index}
        className="absolute inset-0"
        style={{
          opacity: transition === "fade" ? (visible ? 1 : 0) : 1,
          transition: transition === "fade" ? `opacity ${transitionDuration}ms ease-in-out` : undefined,
        }}
      >
        {current.type?.startsWith("video") ? (
          <video
            src={current.url}
            className="w-full h-full"
            style={{ objectFit: fit }}
            muted
            autoPlay
            loop
            playsInline
          />
        ) : (
          <img
            src={current.url}
            alt=""
            className="w-full h-full"
            style={{ objectFit: fit }}
          />
        )}
      </div>
    </div>
  );
}
