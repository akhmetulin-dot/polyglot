import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BookOpen, Settings, List, Play, CheckCircle2 } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Главная", icon: BookOpen },
    { href: "/words", label: "Словарь", icon: List },
    { href: "/settings", label: "Настройки", icon: Settings },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground pb-20 md:pb-0 md:pl-64">
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-card/80 px-4 py-3 backdrop-blur-md md:bottom-auto md:right-auto md:top-0 md:h-screen md:w-64 md:flex-col md:justify-start md:border-r md:border-t-0 md:px-6 md:py-8">
        <div className="hidden md:flex items-center gap-2 mb-12 w-full">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-primary">Полиглот</span>
        </div>

        <div className="flex w-full md:flex-col md:gap-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 rounded-lg p-2 md:px-4 md:py-3 transition-colors flex-1 md:flex-none",
                  isActive
                    ? "text-primary md:bg-primary/10 font-semibold"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-6 w-6 md:h-5 md:w-5" />
                <span className="text-[10px] md:text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
