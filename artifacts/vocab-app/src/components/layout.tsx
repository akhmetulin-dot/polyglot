import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { BookOpen, Settings, List, Home, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/words", label: "Словарь", icon: List },
  { href: "/settings", label: "Настройки", icon: Settings },
];

function NavLinks({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  return (
    <>
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
              isActive
                ? "text-primary bg-primary/10 font-semibold"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="text-sm">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground md:pl-64">

      {/* ── Mobile top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 border-b bg-card/90 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="font-serif font-bold text-lg tracking-tight text-primary">Полиглот</span>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="font-serif font-bold text-xl tracking-tight text-primary">Полиглот</span>
            </div>
            <NavLinks onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {/* ── Desktop sidebar ── */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col border-r bg-card/80 px-6 py-8 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-12">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-primary">Полиглот</span>
        </div>
        <div className="flex flex-col gap-2">
          <NavLinks />
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="flex-1 w-full max-w-2xl mx-auto p-4 pt-[4.5rem] md:pt-8 md:p-8">
        {children}
      </main>
    </div>
  );
}
