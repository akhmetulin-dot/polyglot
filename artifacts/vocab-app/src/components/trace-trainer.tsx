import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ArrowRight, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Word } from "@workspace/api-client-react";

interface TraceTrainerProps {
  words: Word[];
  repetitions?: number; // number of rolls (катки)
  title?: string;
  onFinish?: () => void;
  headerRight?: ReactNode;
}

type Field = "pl" | "de" | "en";

interface StepState {
  field: Field;
  value: string;
  done: boolean;
  flash: boolean;
}

const FLAG: Record<Field, string> = { pl: "🇵🇱", de: "🇩🇪", en: "🇬🇧" };
const LANG: Record<Field, string> = { pl: "pl", de: "de", en: "en" };

function getActiveFields(word: Word): Field[] {
  const f: Field[] = [];
  if (word.polish)  f.push("pl");
  if (word.german)  f.push("de");
  if (word.english) f.push("en");
  return f;
}

/**
 * Build the full step sequence for N rolls.
 * 1 roll  = PL → DE → EN → DE → PL  (forward + backward without repeating the turn point)
 * 2 rolls = [PL→DE→EN→DE→PL] [PL→DE→EN→DE→PL]
 */
function buildRollSequence(fields: Field[], rolls: number): Field[] {
  if (!fields.length) return [];
  if (fields.length === 1) {
    // Only one language: just repeat it `rolls` times
    return Array.from({ length: rolls }, () => fields[0]);
  }
  const forward  = [...fields];
  const backward = [...fields].slice(0, -1).reverse(); // remove last, reverse
  const oneRoll  = [...forward, ...backward];
  const result: Field[] = [];
  for (let i = 0; i < rolls; i++) result.push(...oneRoll);
  return result;
}

function getWordValue(word: Word, field: Field): string {
  return (field === "pl" ? word.polish : field === "de" ? word.german : word.english) ?? "";
}

function buildSteps(word: Word, rolls: number): StepState[] {
  const fields = getActiveFields(word);
  return buildRollSequence(fields, rolls).map(field => ({
    field, value: "", done: false, flash: false,
  }));
}

// ─── Landscape detection ─────────────────────────────────────────────────────
function useIsLandscape() {
  const check = () =>
    typeof window !== "undefined" &&
    window.innerWidth > window.innerHeight &&
    window.innerHeight < 600;
  const [landscape, setLandscape] = useState(check);
  useEffect(() => {
    const h = () => setLandscape(check());
    window.addEventListener("resize", h);
    screen.orientation?.addEventListener?.("change", h);
    return () => {
      window.removeEventListener("resize", h);
      screen.orientation?.removeEventListener?.("change", h);
    };
  }, []);
  return landscape;
}

// ─────────────────────────────────────────────────────────────────────────────

export function TraceTrainer({
  words,
  repetitions = 1,
  onFinish,
  headerRight,
}: TraceTrainerProps) {
  const [wordIndex, setWordIndex]           = useState(0);
  const [steps, setSteps]                   = useState<StepState[]>(() =>
    words[0] ? buildSteps(words[0], repetitions) : []
  );
  const [completedWords, setCompletedWords] = useState(0);
  const [finished, setFinished]             = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const bridgeRef     = useRef<HTMLInputElement>(null);
  const isLandscape   = useIsLandscape();

  // Pending focus id — applied synchronously in useEffect (iOS-safe)
  const pendingFocusId     = useRef<string | null>(null);
  const focusFirstOnRender = useRef(false);

  useEffect(() => {
    if (focusFirstOnRender.current) {
      focusFirstOnRender.current = false;
      firstInputRef.current?.focus();
      return;
    }
    if (pendingFocusId.current) {
      const id = pendingFocusId.current;
      pendingFocusId.current = null;
      (document.getElementById(id) as HTMLInputElement | null)?.focus();
    }
  });

  const current: Word | undefined = words[wordIndex];

  // Reset steps when word or rolls change
  useEffect(() => {
    if (!current) return;
    setSteps(buildSteps(current, repetitions));
    focusFirstOnRender.current = true;
  }, [wordIndex, repetitions]);

  // Advance to next word when all steps are done
  useEffect(() => {
    if (finished || steps.length === 0 || !steps.every(s => s.done)) return;
    const next = wordIndex + 1;
    setCompletedWords(c => c + 1);
    if (next >= words.length) {
      setFinished(true);
      onFinish?.();
    } else {
      setWordIndex(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  const norm = (s: string) => s.trim().toLowerCase();

  const handleChange = (idx: number, value: string) => {
    if (!current || steps[idx]?.done) return;
    const step   = steps[idx];
    const target = getWordValue(current, step.field);
    const ok     = !!target && norm(value) === norm(target);

    if (ok) {
      const next   = steps.map((s, i) => i === idx ? { ...s, value, done: true, flash: true } : s);
      const allDone = next.every(s => s.done);
      if (allDone) {
        // iOS bridge: keep keyboard open through word transition
        bridgeRef.current?.focus();
      } else {
        const nextIdx = next.findIndex(s => !s.done);
        if (nextIdx >= 0) pendingFocusId.current = `trace-step-${nextIdx}`;
      }
      setSteps(next);
      setTimeout(() => setSteps(s => s.map((x, i) => i === idx ? { ...x, flash: false } : x)), 400);
    } else {
      setSteps(steps.map((s, i) => i === idx ? { ...s, value } : s));
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!isLandscape) {
      setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  };

  const handleSkip = () => {
    const next = wordIndex + 1;
    if (next >= words.length) { setFinished(true); onFinish?.(); }
    else { setCompletedWords(c => c + 1); setWordIndex(next); }
  };

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!words.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <PenLine className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Нет слов для прописей</p>
        <Link href="/"><Button>На главную</Button></Link>
      </div>
    );
  }

  // ── Finished ─────────────────────────────────────────────────────────────
  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="p-6 bg-primary/10 rounded-full text-primary">
          <Check className="h-12 w-12" />
        </div>
        <h2 className="text-3xl font-bold font-serif text-primary">Готово!</h2>
        <p className="text-muted-foreground">
          {completedWords} слов · {repetitions} {repetitions === 1 ? "каток" : repetitions < 5 ? "катка" : "катков"}
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button size="lg" variant="outline" onClick={() => {
            setFinished(false);
            setCompletedWords(0);
            setWordIndex(0);
            setSteps(words[0] ? buildSteps(words[0], repetitions) : []);
          }}>
            Ещё раз
          </Button>
          <Link href="/train"><Button size="lg">Начать тест →</Button></Link>
          <Link href="/"><Button size="lg" variant="ghost">На главную</Button></Link>
        </div>
      </div>
    );
  }

  if (!current || !steps.length) return null;

  // Roll size: for n fields → forward(n) + backward(n-1) = 2n-1
  const fields   = getActiveFields(current);
  const rollSize = fields.length <= 1 ? 1 : fields.length * 2 - 1;
  const currentStepIdx = steps.findIndex(s => !s.done);

  // ── Shared UI pieces ─────────────────────────────────────────────────────

  const bridge = (
    <input
      ref={bridgeRef}
      aria-hidden="true"
      tabIndex={-1}
      readOnly
      style={{ position: "fixed", left: "-9999px", top: "-9999px", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
    />
  );

  const progressBar = <Progress value={(completedWords / words.length) * 100} className="h-1" />;

  const counter = (
    <div className="text-sm font-semibold bg-secondary/60 px-3 py-1.5 rounded-full flex items-center gap-1 text-primary shrink-0">
      <Check className="h-3.5 w-3.5" /> {completedWords}/{words.length}
    </div>
  );

  const referenceCard = (
    <div className="py-3 px-3 border rounded-xl bg-muted/30 space-y-1">
      <p className="font-bold font-serif text-2xl leading-tight">{current.russian}</p>
      <p className="text-sm text-muted-foreground overflow-x-auto scrollbar-none">
        {[current.polish, current.german, current.english].filter(Boolean).join(" · ")}
      </p>
      {current.mnemonic && (
        <p className="text-xs text-primary/50 italic leading-relaxed">{current.mnemonic}</p>
      )}
    </div>
  );

  // ── Step rows ─────────────────────────────────────────────────────────────
  const stepsUI = (
    <div className="space-y-0.5">
      {steps.map((step, i) => {
        const isActive = i === currentStepIdx;
        const isLocked = !step.done && i > currentStepIdx;
        const hint     = getWordValue(current, step.field);

        // Roll separator before each new roll (except the first)
        const isRollStart = i > 0 && i % rollSize === 0 && fields.length > 1;
        const rollNum     = Math.floor(i / rollSize) + 1;

        return (
          <div key={i}>
            {isRollStart && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-[10px] text-muted-foreground/60 font-mono tracking-widest uppercase">
                  каток {rollNum}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
            )}

            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200",
                step.flash  && "success-pulse",
                isLocked    && "opacity-25 pointer-events-none",
                isActive    && "bg-primary/5 ring-1 ring-primary/20",
              )}
            >
              {/* Flag / check */}
              <span className="text-base shrink-0 w-7 text-center select-none leading-none">
                {step.done ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : FLAG[step.field]}
              </span>

              {step.done ? (
                /* Completed: show the typed word */
                <span className="text-sm text-green-600 dark:text-green-400 font-medium flex-1 font-mono">
                  {step.value}
                </span>
              ) : (
                /* Active / locked: hint label + auto-sizing input */
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[11px] text-muted-foreground/60 font-mono leading-none mb-0.5 truncate select-none">
                    {hint}
                  </span>
                  <div className="inline-grid w-full">
                    {/* Hidden sizer so input grows with content */}
                    <span
                      aria-hidden
                      className="invisible whitespace-pre text-sm px-0 py-0.5 col-start-1 row-start-1"
                      style={{ fontFamily: "inherit" }}
                    >
                      {step.value || hint || "____"}
                    </span>
                    <input
                      ref={i === 0 ? firstInputRef : undefined}
                      id={`trace-step-${i}`}
                      value={step.value}
                      onChange={e => handleChange(i, e.target.value)}
                      onFocus={handleInputFocus}
                      disabled={isLocked || step.done}
                      lang={LANG[step.field]}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={cn(
                        "col-start-1 row-start-1 w-full bg-transparent",
                        "border-0 border-b-2 rounded-none px-0 py-0.5 text-sm",
                        "focus:outline-none transition-colors",
                        isActive ? "border-primary" : "border-border/50",
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const skipButton = (
    <Button variant="ghost" size="sm" className="text-muted-foreground self-center mt-1" onClick={handleSkip}>
      Пропустить <ArrowRight className="ml-1 h-4 w-4" />
    </Button>
  );

  // ── LANDSCAPE ────────────────────────────────────────────────────────────
  if (isLandscape) {
    return (
      <div className="w-full flex flex-col gap-2">
        {bridge}
        <div className="flex items-center gap-3">
          <div className="flex-1">{progressBar}</div>
          {counter}
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-4 items-start">
          <div className="space-y-2">
            {referenceCard}
            <div className="min-w-0 text-xs text-muted-foreground">{headerRight}</div>
          </div>
          <div className="flex flex-col gap-3">
            {stepsUI}
            {skipButton}
          </div>
        </div>
      </div>
    );
  }

  // ── PORTRAIT ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">
      {bridge}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{headerRight}</div>
        {counter}
      </div>
      {progressBar}
      {referenceCard}
      {stepsUI}
      {skipButton}
    </div>
  );
}
