import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Check, ArrowRight, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Word } from "@workspace/api-client-react";

interface TraceTrainerProps {
  words: Word[];
  repetitions?: number; // how many times to trace each word
  title?: string;
  onFinish?: () => void;
}

interface RowState {
  pl: string;
  de: string;
  en: string;
  done: boolean;
  flash: boolean;
}

export function TraceTrainer({ words, repetitions = 3, title = "Прописи", onFinish }: TraceTrainerProps) {
  const [wordIndex, setWordIndex] = useState(0);
  const [rows, setRows] = useState<RowState[]>(() =>
    Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false }))
  );
  const [completedWords, setCompletedWords] = useState(0);
  const [finished, setFinished] = useState(false);
  const firstPlRef = useRef<HTMLInputElement>(null);

  const current: Word | undefined = words[wordIndex];

  // Reset rows when word changes
  useEffect(() => {
    setRows(Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false })));
    setTimeout(() => firstPlRef.current?.focus(), 50);
  }, [wordIndex, repetitions]);

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
        <p className="text-muted-foreground">{completedWords} слов · {repetitions} раз каждое</p>
        <Link href="/">
          <Button size="lg">На главную</Button>
        </Link>
      </div>
    );
  }

  const norm = (s: string) => s.trim().toLowerCase();

  const handleChange = (rowIndex: number, field: "pl" | "de" | "en", value: string) => {
    setRows(prev => {
      const next = prev.map((r, i) => i === rowIndex ? { ...r, [field]: value } : r);
      const row = next[rowIndex];

        const plOk = !current.polish || norm(row.pl) === norm(current.polish ?? "");
      const deOk = !current.german || norm(row.de) === norm(current.german ?? "");
      const enOk = !current.english || norm(row.en) === norm(current.english ?? "");

      if (plOk && deOk && enOk && !row.done) {
        next[rowIndex] = { ...row, done: true, flash: true };
        // Remove flash after 800ms
        setTimeout(() => {
          setRows(r => r.map((x, i) => i === rowIndex ? { ...x, flash: false } : x));
          // Focus next row or finish word
          const nextRow = rowIndex + 1;
          if (nextRow < repetitions) {
            document.getElementById(`trace-pl-${nextRow}`)?.focus();
          } else {
            // All rows done — advance word
            const nextWord = wordIndex + 1;
            if (nextWord >= words.length) {
              setCompletedWords(c => c + 1);
              setFinished(true);
              onFinish?.();
            } else {
              setCompletedWords(c => c + 1);
              setWordIndex(nextWord);
            }
          }
        }, 800);
      }
      return next;
    });
  };

  const progressPercent = (completedWords / words.length) * 100;

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-serif text-muted-foreground">{title}</h1>
        <div className="flex items-center gap-3 text-sm font-semibold bg-secondary/50 px-4 py-2 rounded-full">
          <span className="text-primary flex items-center gap-1">
            <Check className="h-4 w-4" /> {completedWords} / {words.length}
          </span>
        </div>
      </div>

      <Progress value={progressPercent} className="h-2" />

      {/* Reference line */}
      <div className="text-center py-3 border rounded-xl bg-muted/30">
        <span className="font-bold font-serif text-2xl">{current.russian}</span>
        {current.polish && <span className="text-muted-foreground ml-2">— {current.polish}</span>}
        {current.german && <span className="text-muted-foreground ml-2">— {current.german}</span>}
        {current.english && <span className="text-muted-foreground ml-2">— {current.english}</span>}
      </div>

      {/* Trace rows */}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2 p-3 rounded-xl border transition-colors",
              row.done && !row.flash && "border-green-400/50 bg-green-50/30 dark:bg-green-950/10",
              row.flash && "success-pulse border-green-500",
              !row.done && i > 0 && rows[i - 1]?.done === false && "opacity-40 pointer-events-none",
            )}
          >
            {/* Russian word — always visible, bold */}
            <span className={cn(
              "font-bold font-serif text-base shrink-0 min-w-[70px]",
              row.done ? "text-green-600 dark:text-green-400" : "text-foreground"
            )}>
              {current.russian}
            </span>

            {/* PL input */}
            {current.polish && (
              <Input
                id={`trace-pl-${i}`}
                ref={i === 0 ? firstPlRef : undefined}
                value={row.pl}
                onChange={e => handleChange(i, "pl", e.target.value)}
                placeholder={current.polish}
                disabled={row.done}
                lang="pl"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-9 text-sm font-mono bg-card",
                  row.done && "border-green-400 text-green-700 dark:text-green-400"
                )}
              />
            )}

            {/* DE input */}
            {current.german && (
              <Input
                value={row.de}
                onChange={e => handleChange(i, "de", e.target.value)}
                placeholder={current.german}
                disabled={row.done}
                lang="de"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-9 text-sm font-mono bg-card",
                  row.done && "border-green-400 text-green-700 dark:text-green-400"
                )}
              />
            )}

            {/* EN input */}
            {current.english && (
              <Input
                value={row.en}
                onChange={e => handleChange(i, "en", e.target.value)}
                placeholder={current.english}
                disabled={row.done}
                lang="en"
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
                className={cn(
                  "h-9 text-sm font-mono bg-card",
                  row.done && "border-green-400 text-green-700 dark:text-green-400"
                )}
              />
            )}

            {row.done && <Check className="h-4 w-4 text-green-500 shrink-0" />}
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground self-center"
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
