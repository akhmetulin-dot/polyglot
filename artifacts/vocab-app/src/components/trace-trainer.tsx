import { useState, useEffect, useRef, forwardRef, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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

type Field = "pl" | "de" | "en";

function getActiveFields(word: Word): Field[] {
  const fields: Field[] = [];
  if (word.polish)  fields.push("pl");
  if (word.german)  fields.push("de");
  if (word.english) fields.push("en");
  return fields;
}

// ─── Auto-sizing input with persistent hint ────────────────────────────────
// The container uses inline-grid so it always has the width of the longer child
// (hidden sizer span vs visible input). The hint label above never disappears.
interface FieldInputProps {
  id: string;
  hint: string;           // target word — shown above, always visible
  value: string;
  onChange: (v: string) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  done: boolean;
  lang?: string;
}

const FieldInput = forwardRef<HTMLInputElement, FieldInputProps>(
  ({ id, hint, value, onChange, onFocus, done, lang }, ref) => {
    return (
      <div className="flex flex-col items-stretch min-w-0" style={{ flex: Math.max(hint.length, 4) }}>
        {/* Always-visible target word above the input */}
        <span className="text-[11px] text-muted-foreground/60 font-mono leading-none mb-1 truncate select-none">
          {hint}
        </span>

        {/* inline-grid sizer: container width = max(hint width, typed width) */}
        <div className="inline-grid w-full">
          {/* Hidden sizer — gives the container the right width */}
          <span
            aria-hidden
            className="invisible whitespace-pre text-sm px-0 py-1 col-start-1 row-start-1"
            style={{ fontFamily: "inherit" }}
          >
            {value || hint || "____"}
          </span>

          {/* Actual input on top of sizer */}
          <input
            ref={ref}
            id={id}
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={onFocus}
            disabled={done}
            lang={lang}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className={cn(
              "col-start-1 row-start-1 w-full bg-transparent",
              "border-0 border-b-2 rounded-none px-0 py-1 text-sm",
              "focus:outline-none transition-colors",
              done
                ? "border-green-400/60 text-green-700 dark:text-green-400 cursor-default"
                : "border-border focus:border-primary",
            )}
          />
        </div>
      </div>
    );
  }
);
FieldInput.displayName = "FieldInput";

// ──────────────────────────────────────────────────────────────────────────────

export function TraceTrainer({
  words,
  repetitions = 3,
  onFinish,
  headerRight,
}: TraceTrainerProps) {
  const [wordIndex, setWordIndex]         = useState(0);
  const [rows, setRows]                   = useState<RowState[]>(() =>
    Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false }))
  );
  const [completedWords, setCompletedWords] = useState(0);
  const [finished, setFinished]           = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const current: Word | undefined = words[wordIndex];

  useEffect(() => {
    setRows(Array.from({ length: repetitions }, () => ({ pl: "", de: "", en: "", done: false, flash: false })));
    setTimeout(() => firstInputRef.current?.focus(), 60);
  }, [wordIndex, repetitions]);

  const norm = (s: string) => s.trim().toLowerCase();

  const handleChange = (rowIndex: number, field: Field, value: string) => {
    if (!current) return;

    setRows(prev => {
      if (prev[rowIndex].done) return prev;

      const next = prev.map((r, i) =>
        i === rowIndex ? { ...r, [field]: value } : r
      );
      const row = next[rowIndex];

      const plOk = !current.polish  || norm(row.pl) === norm(current.polish  ?? "");
      const deOk = !current.german  || norm(row.de) === norm(current.german  ?? "");
      const enOk = !current.english || norm(row.en) === norm(current.english ?? "");

      // ── Auto-advance: if this field is now correct, jump to next in order ──
      const isCurrentCorrect =
        (field === "pl" && !!current.polish  && norm(value) === norm(current.polish))  ||
        (field === "de" && !!current.german  && norm(value) === norm(current.german))  ||
        (field === "en" && !!current.english && norm(value) === norm(current.english));

      if (isCurrentCorrect) {
        const fieldOrder = getActiveFields(current);
        const fieldIdx   = fieldOrder.indexOf(field);
        if (fieldIdx < fieldOrder.length - 1) {
          const nextField = fieldOrder[fieldIdx + 1];
          // Only jump if next field isn't already correct
          const nextValue = row[nextField];
          const nextTarget =
            nextField === "pl" ? current.polish :
            nextField === "de" ? current.german : current.english;
          const nextAlreadyOk = !!nextTarget && norm(nextValue) === norm(nextTarget);
          if (!nextAlreadyOk) {
            setTimeout(() => {
              document.getElementById(`trace-input-${rowIndex}-${nextField}`)?.focus();
            }, 0);
          }
        }
      }

      // ── All fields in row correct → flash + advance ──
      if (plOk && deOk && enOk) {
        next[rowIndex] = { ...row, done: true, flash: true };

        setTimeout(() => {
          setRows(r =>
            r.map((x, i) => i === rowIndex ? { ...x, flash: false } : x)
          );
          setRows(r => {
            const allDone = r.every(x => x.done);
            if (allDone) {
              const nextWord = wordIndex + 1;
              setCompletedWords(c => c + 1);
              if (nextWord >= words.length) {
                setFinished(true);
                onFinish?.();
              } else {
                setWordIndex(nextWord);
              }
            } else {
              const firstUndone = r.findIndex(x => !x.done);
              if (firstUndone >= 0) {
                const firstField = getActiveFields(current)[0];
                setTimeout(() => {
                  document.getElementById(`trace-input-${firstUndone}-${firstField}`)?.focus();
                }, 0);
              }
            }
            return r;
          });
        }, 700);
      }

      return next;
    });
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  };

  // ── Empty / Finished states ────────────────────────────────────────────────

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
            setFinished(false);
            setCompletedWords(0);
            setWordIndex(0);
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
  const haDe  = !!current.german;
  const hasEn = !!current.english;

  const translationLine = [current.polish, current.german, current.english]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{headerRight}</div>
        <div className="text-sm font-semibold bg-secondary/60 px-3 py-1.5 rounded-full flex items-center gap-1 text-primary shrink-0">
          <Check className="h-3.5 w-3.5" /> {completedWords}/{words.length}
        </div>
      </div>

      <Progress value={progressPercent} className="h-1" />

      {/* Reference card:
            line 1 — Russian word (large, bold)
            line 2 — all translations on one row, no wrapping
            line 3 — mnemonic */}
      <div className="py-3 px-3 border rounded-xl bg-muted/30 space-y-1">
        <p className="font-bold font-serif text-2xl leading-tight">{current.russian}</p>
        <p className="text-sm text-muted-foreground whitespace-nowrap overflow-x-auto scrollbar-none">
          {translationLine}
        </p>
        {current.mnemonic && (
          <p className="text-xs text-primary/50 italic leading-relaxed">{current.mnemonic}</p>
        )}
      </div>

      {/* Trace rows:
            Each row = flex row of auto-sized inputs.
            Each input has the target word always visible above it.
            Proportional width: flex = word.length so longer words get more space.
            Horizontal scroll if all words are very long. */}
      <div className="space-y-4">
        {rows.map((row, i) => {
          const isLocked = !row.done && !rows.slice(0, i).every(r => r.done);
          return (
            <div
              key={i}
              className={cn(
                "flex gap-3 w-full overflow-x-auto scrollbar-none transition-opacity duration-300",
                row.flash && "success-pulse",
                isLocked && "opacity-35 pointer-events-none",
              )}
            >
              {hasPl && (
                <FieldInput
                  ref={i === 0 ? firstInputRef : undefined}
                  id={`trace-input-${i}-pl`}
                  hint={current.polish ?? ""}
                  value={row.pl}
                  onChange={v => handleChange(i, "pl", v)}
                  onFocus={handleInputFocus}
                  done={row.done}
                  lang="pl"
                />
              )}
              {haDe && (
                <FieldInput
                  ref={i === 0 && !hasPl ? firstInputRef : undefined}
                  id={`trace-input-${i}-de`}
                  hint={current.german ?? ""}
                  value={row.de}
                  onChange={v => handleChange(i, "de", v)}
                  onFocus={handleInputFocus}
                  done={row.done}
                  lang="de"
                />
              )}
              {hasEn && (
                <FieldInput
                  ref={i === 0 && !hasPl && !haDe ? firstInputRef : undefined}
                  id={`trace-input-${i}-en`}
                  hint={current.english ?? ""}
                  value={row.en}
                  onChange={v => handleChange(i, "en", v)}
                  onFocus={handleInputFocus}
                  done={row.done}
                  lang="en"
                />
              )}
            </div>
          );
        })}
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
