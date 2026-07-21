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

  // Scroll focused input into view above keyboard (iOS fix)
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
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
        <h2 className="text-3xl font-bold font-serif text-primary">Готово!</h2>
        <p className="text-muted-foreground">{completedWords} слов · {repetitions}× каждое</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button size="lg" variant="outline" onClick={() => {
            setFinished(false); setCompletedWords(0); setWordIndex(0);
            setRows(Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false })));
          }}>
            Ещё раз
          </Button>
          <Link href="/train"><Button size="lg">Начать тест →</Button></Link>
          <Link href="/"><Button size="lg" variant="ghost">На главную</Button></Link>
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
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">

      {/* Header — compact: pills left, counter right */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{headerRight}</div>
        <div className="text-sm font-semibold bg-secondary/60 px-3 py-1.5 rounded-full flex items-center gap-1 text-primary shrink-0">
          <Check className="h-3.5 w-3.5" /> {completedWords}/{words.length}
        </div>
      </div>

      <Progress value={progressPercent} className="h-1" />

      {/* Reference card — Russian bold + all translations, mnemonic fully shown */}
      <div className="py-2.5 px-3 border rounded-xl bg-muted/30">
        <p className="overflow-hidden whitespace-nowrap overflow-ellipsis leading-snug">
          <span className="font-bold font-serif text-xl">{current.russian}</span>
          {hasPl && <span className="text-muted-foreground text-sm"> — {current.polish}</span>}
          {haDe && <span className="text-muted-foreground text-sm"> — {current.german}</span>}
          {hasEn && <span className="text-muted-foreground text-sm"> — {current.english}</span>}
        </p>
        {current.mnemonic && (
          <p className="text-xs text-primary/50 italic mt-1 leading-relaxed">{current.mnemonic}</p>
        )}
      </div>

      {/* Trace rows — no Russian repeat, no numbers, minimal chrome, full width inputs */}
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "grid gap-1.5 items-center transition-all duration-300",
              hasPl && haDe && hasEn ? "grid-cols-3" :
              (hasPl && haDe) || (hasPl && hasEn) || (haDe && hasEn) ? "grid-cols-2" :
              "grid-cols-1",
              row.flash && "success-pulse",
            )}
          >
            {hasPl && (
              <Input
                id={`trace-input-${i}-pl`}
                ref={i === 0 ? firstInputRef : undefined}
                value={row.pl}
                onChange={e => handleChange(i, "pl", e.target.value)}
                onFocus={handleInputFocus}
                placeholder={current.polish ?? ""}
                disabled={row.done}
                lang="pl"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-9 text-sm min-w-0 transition-colors",
                  row.done && "border-green-400/50 bg-green-50/30 dark:bg-green-950/10 text-green-700 dark:text-green-400",
                  !row.done && !rows.slice(0, i).every(r => r.done) && "opacity-40",
                )}
              />
            )}
            {haDe && (
              <Input
                id={`trace-input-${i}-de`}
                ref={i === 0 && !hasPl ? firstInputRef : undefined}
                value={row.de}
                onChange={e => handleChange(i, "de", e.target.value)}
                onFocus={handleInputFocus}
                placeholder={current.german ?? ""}
                disabled={row.done}
                lang="de"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-9 text-sm min-w-0 transition-colors",
                  row.done && "border-green-400/50 bg-green-50/30 dark:bg-green-950/10 text-green-700 dark:text-green-400",
                  !row.done && !rows.slice(0, i).every(r => r.done) && "opacity-40",
                )}
              />
            )}
            {hasEn && (
              <Input
                id={`trace-input-${i}-en`}
                ref={i === 0 && !hasPl && !haDe ? firstInputRef : undefined}
                value={row.en}
                onChange={e => handleChange(i, "en", e.target.value)}
                onFocus={handleInputFocus}
                placeholder={current.english ?? ""}
                disabled={row.done}
                lang="en"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-9 text-sm min-w-0 transition-colors",
                  row.done && "border-green-400/50 bg-green-50/30 dark:bg-green-950/10 text-green-700 dark:text-green-400",
                  !row.done && !rows.slice(0, i).every(r => r.done) && "opacity-40",
                )}
              />
            )}
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
