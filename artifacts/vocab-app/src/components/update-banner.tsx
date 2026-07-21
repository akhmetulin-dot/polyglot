import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "UPDATE_AVAILABLE") {
        setVisible(true);
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-14 md:top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-primary text-primary-foreground shadow-md md:pl-68">
      <div className="flex items-center gap-2 text-sm font-medium">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin-slow" />
        <span>Доступно обновление приложения</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary-foreground/20 hover:bg-primary-foreground/30 px-3 py-1 text-xs font-semibold transition-colors"
        >
          Обновить
        </button>
        <button
          onClick={() => setVisible(false)}
          className="rounded-md p-1 hover:bg-primary-foreground/20 transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
