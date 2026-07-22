import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BookOpen, Settings, List, Home, PenLine, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { UpdateBanner } from "@/components/update-banner";
import { useGetSettings } from "@workspace/api-client-react";

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: "/",         label: "Главная",   icon: Home     },
  { href: "/words",    label: "Словарь",   icon: List     },
  { href: "/trace",    label: "Прописи",   icon: PenLine  },
  { href: "/settings", label: "Настройки", icon: Settings },
];

// Arc angles (degrees): 90°=up, 180°=left — goes toward screen center
const ANGLES = [90, 120, 150, 180];
const FAB_R  = 28; // FAB radius px  (56px diameter)
const ITEM_R = 24; // item radius px (48px diameter)
const ARC_R  = 92; // orbit radius px

// ── App icon with fallback ────────────────────────────────────────────────────
function AppIcon({ url, name, className }: { url: string; name: string; className?: string }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [url]);
  if (!err) {
    return (
      <img
        src={url}
        alt={name}
        className={cn("h-full w-full object-cover rounded-full", className)}
        onError={() => setErr(true)}
      />
    );
  }
  return <BookOpen className="h-6 w-6" />;
}

// ── Radial wheel menu ─────────────────────────────────────────────────────────
function RadialMenu({ appName }: { appName: string }) {
  const [open, setOpen]     = useState(false);
  const [location, navigate] = useLocation();
  const { dark, toggle }    = useTheme();

  const go = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  const offset = FAB_R - ITEM_R; // 4px — centers item circle on FAB circle

  return (
    <>
      {/* Tap-outside backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      {/* Wheel wrapper — anchored at bottom-right */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width:  FAB_R * 2,
          height: FAB_R * 2,
          zIndex: 50,
        }}
      >
        {/* ── Arc nav items ── */}
        {NAV_ITEMS.map((item, i) => {
          const rad    = (ANGLES[i] * Math.PI) / 180;
          const tx     = Math.round(Math.cos(rad) * ARC_R);   // negative = left
          const ty     = Math.round(-Math.sin(rad) * ARC_R);  // negative = up
          const active = location === item.href;

          return (
            <div
              key={item.href}
              style={{
                position: "absolute",
                right:    offset,
                bottom:   offset,
                transform: open
                  ? `translate(${tx}px, ${ty}px) scale(1)`
                  : "translate(0,0) scale(0.3)",
                opacity:      open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transition: open
                  ? `transform ${200 + i * 45}ms cubic-bezier(0.34,1.56,0.64,1), opacity 160ms ${i * 30}ms`
                  : `transform 140ms ease-in, opacity 100ms`,
              }}
            >
              {/* Label — appears to the LEFT of each button */}
              <span
                style={{
                  position:  "absolute",
                  right:     ITEM_R * 2 + 8,
                  top:       "50%",
                  transform: "translateY(-50%)",
                  transition: `opacity ${open ? 200 + i * 45 + 80 : 80}ms`,
                  opacity:   open ? 1 : 0,
                }}
                className={cn(
                  "whitespace-nowrap text-xs font-semibold rounded-full px-2.5 py-0.5 shadow-sm select-none",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card/95 text-foreground border border-border backdrop-blur-sm"
                )}
              >
                {item.label}
              </span>

              {/* Icon button */}
              <button
                onClick={() => go(item.href)}
                style={{ width: ITEM_R * 2, height: ITEM_R * 2 }}
                className={cn(
                  "rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90",
                  active
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                    : "bg-card text-muted-foreground border border-border"
                )}
              >
                <item.icon className="h-5 w-5" />
              </button>
            </div>
          );
        })}

        {/* ── Main FAB — app icon ── */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Меню"
          style={{ width: FAB_R * 2, height: FAB_R * 2 }}
          className={cn(
            "relative rounded-full flex items-center justify-center",
            "bg-primary text-primary-foreground shadow-xl",
            "transition-all duration-200 active:scale-95 overflow-hidden",
            open && "ring-4 ring-primary/25 ring-offset-2 ring-offset-background"
          )}
        >
          <AppIcon url="/icon-192.png" name={appName} />
        </button>
      </div>

      {/* ── Theme toggle — bottom-left of FAB ── */}
      <button
        onClick={toggle}
        aria-label={dark ? "Светлая тема" : "Тёмная тема"}
        style={{
          position: "fixed",
          bottom: 24 + FAB_R - 18, // vertically centered with FAB
          right:  24 + FAB_R * 2 + 12,
          width:  36,
          height: 36,
          zIndex: 50,
        }}
        className="rounded-full bg-card border border-border shadow flex items-center justify-center text-muted-foreground transition-transform active:scale-90"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: React.ReactNode }) {
  const { data: settings } = useGetSettings();
  const appName = settings?.appName || "Полиглот";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <UpdateBanner />

      {/* ── Content — full width, bottom padding so FAB never covers it ── */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-6 pb-28">
        {children}
      </main>

      <RadialMenu appName={appName} />
    </div>
  );
}
