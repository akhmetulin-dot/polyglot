import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Check, ArrowRight, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Word } from "@workspace/api-client-react";

interface TraceTrainerProps {
  words: Word[];
  repetitions?: number;
  title?: string;
  onFinish?: () => void;
  headerRight?: ReactNode;
}

interface RowState {
  pl: string;
  de: string;
  en: string;
  done: boolean;
  flash: boolean;
}

export function TraceTrainer({
  words,
  repetitions = 3,
  title = "Прописи",
  onFinish,
  headerRight,
}: TraceTrainerProps) {
  const [wordIndex, setWordIndex] = useState(0);
  const [rows, setRows] = useState<RowState[]>(() =>
    Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false }))
  );
  const [completedWords, setCompletedWords] = useState(0);
  const [finished, setFinished] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const current: Word | undefined = words[wordIndex];

  // Reset rows when word changes
  useEffect(() => {
    setRows(Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false })));
    setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [wordIndex, repetitions]);

  const norm = (s: string) => s.trim().toLowerCase();

  const handleChange = (rowIndex: number, field: "pl" | "de" | "en", value: string) => {
    if (!current) return;
    setRows(prev => {
      if (prev[rowIndex].done) return prev;
      const next = prev.map((r, i) => i === rowIndex ? { ...r, [field]: value } : r);
      const row = next[rowIndex];

      const plOk = !current.polish  || norm(row.pl) === norm(current.polish  ?? "");
      const deOk = !current.german  || norm(row.de) === norm(current.german  ?? "");
      const enOk = !current.english || norm(row.en) === norm(current.english ?? "");

      if (plOk && deOk && enOk) {
        next[rowIndex] = { ...row, done: true, flash: true };
        setTimeout(() => {
          setRows(r => r.map((x, i) => i === rowIndex ? { ...x, flash: false } : x));
          // Count done rows; if all done advance word
          setRows(r => {
            const allDone = r.every(x => x.done);
            if (allDone) {
              const nextWord = wordIndex + 1;
              if (nextWord >= words.length) {
                setCompletedWords(c => c + 1);
                setFinished(true);
                onFinish?.();
              } else {
                setCompletedWords(c => c + 1);
                setWordIndex(nextWord);
              }
            } else {
              // Focus the first undone row's first input
              const firstUndone = r.findIndex(x => !x.done);
              if (firstUndone >= 0) {
                const el =
                  document.getElementById(`trace-input-${firstUndone}-pl`) ??
                  document.getElementById(`trace-input-${firstUndone}-de`) ??
                  document.getElementById(`trace-input-${firstUndone}-en`);
                el?.focus();
              }
            }
            return r;
          });
        }, 700);
      }
      return next;
    });
  };

  if (!words.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <PenLine className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Нет слов для прописей</p>
        <Link href="/"><Button>На главную</Button></Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="p-6 bg-primary/10 rounded-full text-primary">
          <Check className="h-12 w-12" />
        </div>
        <h2 className="text-3xl font-bold font-serif text-primary">Прописи завершены!</h2>
        <p className="text-muted-foreground">{completedWords} слов · {repetitions}× каждое</p>
        <div className="flex gap-3">
          <Button size="lg" variant="outline" onClick={() => { setFinished(false); setCompletedWords(0); setWordIndex(0); setRows(Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false }))); }}>
            Ещё раз
          </Button>
          <Link href="/">
            <Button size="lg">На главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const progressPercent = (completedWords / words.length) * 100;
  const hasPl = !!current.polish;
  const haDe = !!current.german;
  const hasEn = !!current.english;

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-serif text-muted-foreground">{title}</h1>
        <div className="flex items-center gap-2">
          {headerRight}
          <div className="text-sm font-semibold bg-secondary/50 px-4 py-2 rounded-full flex items-center gap-1 text-primary">
            <Check className="h-4 w-4" /> {completedWords} / {words.length}
          </div>
        </div>
      </div>

      <Progress value={progressPercent} className="h-1.5" />

      {/* Reference line — shows the full word for visual anchoring */}
      <div className="py-3 px-4 border rounded-xl bg-muted/30 text-center leading-relaxed">
        <span className="font-bold font-serif text-2xl">{current.russian}</span>
        {hasPl && <span className="text-muted-foreground text-base ml-3">— {current.polish}</span>}
        {haDe && <span className="text-muted-foreground text-base ml-3">— {current.german}</span>}
        {hasEn && <span className="text-muted-foreground text-base ml-3">— {current.english}</span>}
        {current.mnemonic && (
          <p className="text-xs text-primary/50 italic mt-1">{current.mnemonic}</p>
        )}
      </div>

      {/* Trace rows — ALL rows accessible simultaneously (like lined paper) */}
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "grid gap-2 items-center p-2.5 rounded-xl border transition-all duration-300",
              hasPl && haDe && hasEn ? "grid-cols-[auto_1fr_1fr_1fr_auto]" :
              (hasPl && haDe) || (hasPl && hasEn) || (haDe && hasEn) ? "grid-cols-[auto_1fr_1fr_auto]" :
              "grid-cols-[auto_1fr_auto]",
              row.done && !row.flash && "border-green-400/40 bg-green-50/20 dark:bg-green-950/10",
              row.flash && "success-pulse border-green-500",
              !row.done && !rows.slice(0, i).every(r => r.done) && "opacity-50",
              !row.done && rows.slice(0, i).every(r => r.done) && "bg-card border-primary/30 shadow-sm",
              !row.done && i === 0 && "bg-card border-primary/30 shadow-sm",
            )}
          >
            {/* Russian */}
            <span className={cn(
              "font-bold font-serif text-sm sm:text-base shrink-0 min-w-[55px] sm:min-w-[70px]",
              row.done ? "text-green-600 dark:text-green-400" : "text-foreground"
            )}>
              {current.russian}
            </span>

            {/* PL */}
            {hasPl && (
              <Input
                id={`trace-input-${i}-pl`}
                ref={i === 0 ? firstInputRef : undefined}
                value={row.pl}
                onChange={e => handleChange(i, "pl", e.target.value)}
                placeholder={current.polish ?? ""}
                disabled={row.done}
                lang="pl"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-8 text-sm font-mono min-w-0",
                  row.done && "border-green-400/60 text-green-700 dark:text-green-400"
                )}
              />
            )}

            {/* DE */}
            {haDe && (
              <Input
                id={`trace-input-${i}-de`}
                ref={i === 0 && !hasPl ? firstInputRef : undefined}
                value={row.de}
                onChange={e => handleChange(i, "de", e.target.value)}
                placeholder={current.german ?? ""}
                disabled={row.done}
                lang="de"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-8 text-sm font-mono min-w-0",
                  row.done && "border-green-400/60 text-green-700 dark:text-green-400"
                )}
              />
            )}

            {/* EN */}
            {hasEn && (
              <Input
                id={`trace-input-${i}-en`}
                ref={i === 0 && !hasPl && !haDe ? firstInputRef : undefined}
                value={row.en}
                onChange={e => handleChange(i, "en", e.target.value)}
                placeholder={current.english ?? ""}
                disabled={row.done}
                lang="en"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-8 text-sm font-mono min-w-0",
                  row.done && "border-green-400/60 text-green-700 dark:text-green-400"
                )}
              />
            )}

            {/* Row number or done checkmark */}
            {row.done
              ? <Check className="h-4 w-4 text-green-500 shrink-0" />
              : <span className="w-4 text-center text-[10px] text-muted-foreground/40 font-mono select-none">{i + 1}</span>
            }
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground self-center mt-1"
        onClick={() => {
          const next = wordIndex + 1;
          if (next >= words.length) { setFinished(true); onFinish?.(); }
          else { setCompletedWords(c => c + 1); setWordIndex(next); }
        }}
      >
        Пропустить <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
