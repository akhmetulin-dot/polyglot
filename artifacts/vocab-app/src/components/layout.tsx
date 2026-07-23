import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BookOpen, Settings, List, Home, PenLine, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { UpdateBanner } from "@/components/update-banner";
import { useGetSettings } from "@workspace/api-client-react";

// ── Arc geometry ─────────────────────────────────────────────────────────────
// 5 items (theme + 4 nav) in a quarter-circle from straight-up to straight-left.
// R=130 gives ~51px centre-to-centre at 22.5° steps, enough for 44px items.
const FAB_R  = 28;   // FAB radius  (56px diameter)
const ITEM_R = 22;   // item radius (44px diameter)
const ARC_R  = 130;  // orbit radius

// Angles in degrees: 90°=up, 180°=left
const ANGLES = [90, 113, 135, 158, 180] as const;

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
  const [open, setOpen]      = useState(false);
  const [location, navigate] = useLocation();
  const { dark, toggle }     = useTheme();

  const NAV_ITEMS = [
    { href: "/",         label: "Главная",   icon: Home     },
    { href: "/words",    label: "Словарь",   icon: List     },
    { href: "/trace",    label: "Прописи",   icon: PenLine  },
    { href: "/settings", label: "Настройки", icon: Settings },
  ];

  // Arc items: index 0 = theme toggle, 1-4 = nav
  type ArcItem =
    | { kind: "theme" }
    | { kind: "nav"; href: string; label: string; Icon: typeof Home };

  const ARC_ITEMS: ArcItem[] = [
    { kind: "theme" },
    ...NAV_ITEMS.map(n => ({ kind: "nav" as const, href: n.href, label: n.label, Icon: n.icon })),
  ];

  const go = (href: string) => { navigate(href); setOpen(false); };

  const offset = FAB_R - ITEM_R; // keeps item circle centred over FAB circle

  return (
    <>
      {/* Tap-outside backdrop */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {/* Wheel wrapper — anchored bottom-right */}
      <div
        style={{
          position: "fixed",
          bottom: 24,
          right:  24,
          width:  FAB_R * 2,
          height: FAB_R * 2,
          zIndex: 50,
        }}
      >
        {/* ── Arc items ── */}
        {ARC_ITEMS.map((item, i) => {
          const rad = (ANGLES[i] * Math.PI) / 180;
          const tx  = Math.round(Math.cos(rad) * ARC_R);   // negative = left
          const ty  = Math.round(-Math.sin(rad) * ARC_R);  // negative = up

          const isTheme = item.kind === "theme";
          const isActive = item.kind === "nav" && location === item.href;

          return (
            <div
              key={i}
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
                  ? `transform ${200 + i * 40}ms cubic-bezier(0.34,1.56,0.64,1), opacity 160ms ${i * 25}ms`
                  : `transform 130ms ease-in, opacity 90ms`,
              }}
            >
              {/* Label (nav items only, to the left of the button) */}
              {!isTheme && (
                <span
                  style={{
                    position:  "absolute",
                    right:     ITEM_R * 2 + 8,
                    top:       "50%",
                    transform: "translateY(-50%)",
                    opacity:   open ? 1 : 0,
                    transition: `opacity ${open ? 200 + i * 40 + 80 : 70}ms`,
                  }}
                  className={cn(
                    "whitespace-nowrap text-xs font-semibold rounded-full px-2.5 py-0.5 shadow-sm select-none",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-card/95 text-foreground border border-border backdrop-blur-sm"
                  )}
                >
                  {(item as { label: string }).label}
                </span>
              )}

              {/* Button */}
              <button
                onClick={() => {
                  if (isTheme) { toggle(); }
                  else { go((item as { href: string }).href); }
                }}
                style={{ width: ITEM_R * 2, height: ITEM_R * 2 }}
                aria-label={isTheme ? (dark ? "Светлая тема" : "Тёмная тема") : (item as { label: string }).label}
                className={cn(
                  "rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90",
                  isActive
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                    : isTheme
                    ? "bg-card text-foreground border border-border"
                    : "bg-card text-muted-foreground border border-border"
                )}
              >
                {isTheme
                  ? (dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)
                  : (() => { const { Icon } = item as { Icon: typeof Home }; return <Icon className="h-5 w-5" />; })()
                }
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
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-6 pb-28">
        {children}
      </main>
      <RadialMenu appName={appName} />
    </div>
  );
}
