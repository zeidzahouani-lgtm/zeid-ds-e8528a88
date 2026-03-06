import { useParams } from "react-router-dom";
import { useScreenRealtime } from "@/hooks/useScreenRealtime";
import { MonitorPlay } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const { screen, media, loading } = useScreenRealtime(id);
  const [visible, setVisible] = useState(true);

  // Transition effect when media changes
  useEffect(() => {
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, [media?.id]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <MonitorPlay className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Connexion à l'écran...</p>
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <p className="text-destructive text-lg">Écran introuvable</p>
      </div>
    );
  }

  const isPortrait = screen.orientation === "portrait";

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      <div
        className="w-full h-full transition-transform duration-700 ease-in-out"
        style={isPortrait ? {
          transform: "rotate(90deg)",
          transformOrigin: "center center",
          width: "100vh",
          height: "100vw",
          position: "absolute",
          top: "50%",
          left: "50%",
          marginTop: "calc(-50vw)",
          marginLeft: "calc(-50vh)",
        } : undefined}
      >
        <div
          className="w-full h-full transition-opacity duration-500 ease-in-out"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {!media ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <MonitorPlay className="h-16 w-16 text-primary/30" />
              <p className="text-muted-foreground text-lg">{screen.name}</p>
              <p className="text-muted-foreground/50 text-sm">En attente de contenu...</p>
            </div>
          ) : media.type === "image" ? (
            <img
              src={media.url}
              alt={media.name}
              className="w-full h-full object-cover"
            />
          ) : media.type === "video" ? (
            <video
              src={media.url}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <iframe
              src={media.url}
              className="w-full h-full border-0"
              allowFullScreen
              title={media.name}
            />
          )}
        </div>
      </div>
    </div>
  );
}
