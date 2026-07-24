import { useState, useEffect, useRef, forwardRef, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ArrowRight, PenLine, Pencil, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { MNEMONIC_GROUP, SEMANTIC_GROUP } from "@/lib/field-meta";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateWord,
  useRecordWordTrace,
  useListTags,
  useCreateTag,
  getListWordsQueryKey,
  getGetWordQueryKey,
  getListTagsQueryKey,
} from "@workspace/api-client-react";
import type { Word } from "@workspace/api-client-react";
import { GroupCombobox } from "@/components/group-combobox";

interface TraceTrainerProps {
  words: Word[];
  repetitions?: number;
  title?: string;
  onFinish?: () => void;
  headerRight?: ReactNode;
}

interface FieldValues {
  pl: string;
  de: string;
  en: string;
}

type Field = "pl" | "de" | "en";

function getActiveFields(word: Word): Field[] {
  const fields: Field[] = [];
  if (word.polish)  fields.push("pl");
  if (word.german)  fields.push("de");
  if (word.english) fields.push("en");
  return fields;
}

/**
 * Even rows (0, 2, 4…) → forward:  PL → DE → EN
 * Odd  rows (1, 3, 5…) → backward: EN → DE → PL
 */
function getRowFields(rowIndex: number, word: Word): Field[] {
  const fields = getActiveFields(word);
  return rowIndex % 2 === 0 ? fields : [...fields].reverse();
}

// ─── Landscape detection ────────────────────────────────────────────────────
function useIsLandscape() {
  const check = () =>
    typeof window !== "undefined" &&
    window.innerWidth > window.innerHeight &&
    window.innerHeight < 600;
  const [landscape, setLandscape] = useState(check);
  useEffect(() => {
    const handler = () => setLandscape(check());
    window.addEventListener("resize", handler);
    screen.orientation?.addEventListener?.("change", handler);
    return () => {
      window.removeEventListener("resize", handler);
      screen.orientation?.removeEventListener?.("change", handler);
    };
  }, []);
  return landscape;
}

// ─── Auto-sizing input with persistent hint ────────────────────────────────
interface FieldInputProps {
  id: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  done: boolean;
  lang?: string;
}

const FieldInput = forwardRef<HTMLInputElement, FieldInputProps>(
  ({ id, hint, value, onChange, onFocus, done, lang }, ref) => (
    <div className="flex flex-col items-stretch min-w-0" style={{ flex: Math.max(hint.length, 4) }}>
      <span className="text-[11px] text-muted-foreground/60 font-mono leading-none mb-1 truncate select-none">
        {hint}
      </span>
      <div className="inline-grid w-full">
        <span
          aria-hidden
          className="invisible whitespace-pre text-sm px-0 py-1 col-start-1 row-start-1"
          style={{ fontFamily: "inherit" }}
        >
          {value || hint || "____"}
        </span>
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
  )
);
FieldInput.displayName = "FieldInput";

// ──────────────────────────────────────────────────────────────────────────────

export function TraceTrainer({
  words,
  repetitions = 3,
  onFinish,
  headerRight,
}: TraceTrainerProps) {
  const [wordIndex, setWordIndex]           = useState(0);
  const [passIndex, setPassIndex]           = useState(0);
  // stepIndex = which position in the current pass sequence (0, 1, 2…) is active
  const [stepIndex, setStepIndex]           = useState(0);
  // What the user is currently typing for the active field
  const [activeInput, setActiveInput]       = useState("");
  // Values already confirmed in the current pass (locked green)
  const [confirmed, setConfirmed]           = useState<FieldValues>({ pl: "", de: "", en: "" });
  // Values from the PREVIOUS pass shown in fields not yet reached (locked green, will clear on focus)
  const [holdValues, setHoldValues]         = useState<FieldValues>({ pl: "", de: "", en: "" });
  const [flash, setFlash]                   = useState(false);
  const [completedWords, setCompletedWords] = useState(0);
  const [finished, setFinished]             = useState(false);
  const firstInputRef      = useRef<HTMLInputElement>(null);
  const bridgeRef          = useRef<HTMLInputElement>(null);
  const isLandscape        = useIsLandscape();
  const pendingFocusId     = useRef<string | null>(null);
  const focusFirstOnRender = useRef(false);

  // ── Inline property editing ──────────────────────────────────────────────
  const [isEditingProps, setIsEditingProps]           = useState(false);
  const [mnemonicDraft, setMnemonicDraft]             = useState("");
  const [wordGroupDraft, setWordGroupDraft]           = useState("");
  const [semanticGroupDraft, setSemanticGroupDraft]   = useState("");
  // Local overrides so UI updates immediately after save without waiting for refetch
  const [localMnemonic, setLocalMnemonic]             = useState<string | null | undefined>(undefined);
  const [localWordGroup, setLocalWordGroup]           = useState<string | null | undefined>(undefined);
  const [localSemanticGroup, setLocalSemanticGroup]   = useState<string | null | undefined>(undefined);
  const mnemonicRef  = useRef<HTMLTextAreaElement>(null);
  const updateWord      = useUpdateWord();
  const recordTrace     = useRecordWordTrace();
  const createTag       = useCreateTag();
  const queryClient     = useQueryClient();

  // Load group tags for the comboboxes (enabled only while editing)
  const { data: mnemoGroupData }    = useListTags({ kind: "mnemonic_group" }, { query: { enabled: isEditingProps } as never });
  const { data: semanticGroupData } = useListTags({ kind: "semantic_group" }, { query: { enabled: isEditingProps } as never });
  const mnemoGroupTags    = mnemoGroupData?.tags    ?? [];
  const semanticGroupTags = semanticGroupData?.tags ?? [];

  // Apply pending focus after every render (iOS-safe: runs in commit phase)
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

  // Reset pass state when word changes
  useEffect(() => {
    setPassIndex(0);
    setStepIndex(0);
    setActiveInput("");
    setConfirmed({ pl: "", de: "", en: "" });
    setHoldValues({ pl: "", de: "", en: "" });
    setFlash(false);
    focusFirstOnRender.current = true;
  }, [wordIndex, repetitions]);

  // Reset editing state when the actual word id changes
  useEffect(() => {
    setLocalMnemonic(undefined);
    setLocalWordGroup(undefined);
    setLocalSemanticGroup(undefined);
    setIsEditingProps(false);
    setMnemonicDraft("");
    setWordGroupDraft("");
    setSemanticGroupDraft("");
  }, [current?.id]);

  const displayMnemonic      = localMnemonic      !== undefined ? localMnemonic      : current?.mnemonic;
  const displayWordGroup     = localWordGroup     !== undefined ? localWordGroup     : current?.wordGroup;
  const displaySemanticGroup = localSemanticGroup !== undefined ? localSemanticGroup : current?.semanticGroup;

  const handleStartEditProps = () => {
    setMnemonicDraft(displayMnemonic || "");
    setWordGroupDraft(displayWordGroup || "");
    setSemanticGroupDraft(displaySemanticGroup || "");
    setIsEditingProps(true);
    setTimeout(() => mnemonicRef.current?.focus(), 50);
  };

  // Auto-create a tag if user typed a new group name not yet in the list
  const ensureTag = (kind: string, value: string, existingTags: { value: string }[]) => {
    if (!value.trim()) return;
    const exists = existingTags.some(t => t.value.toLowerCase() === value.trim().toLowerCase());
    if (!exists) {
      createTag.mutate(
        { data: { kind, value: value.trim(), label: value.trim() } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTagsQueryKey({ kind }) }) }
      );
    }
  };

  const handleSaveProps = () => {
    if (!current) return;
    const mnemonic      = mnemonicDraft      || null;
    const wordGroup     = wordGroupDraft.trim()     || null;
    const semanticGroup = semanticGroupDraft.trim() || null;

    // Auto-create new group tags if needed
    if (wordGroup)     ensureTag("mnemonic_group", wordGroup,     mnemoGroupTags);
    if (semanticGroup) ensureTag("semantic_group", semanticGroup, semanticGroupTags);

    updateWord.mutate(
      {
        id: current.id,
        data: {
          mnemonic:      mnemonic      ?? undefined,
          wordGroup:     wordGroup     ?? undefined,
          semanticGroup: semanticGroup ?? undefined,
        },
      },
      {
        onSuccess: () => {
          // Update local display immediately — no list invalidation to avoid
          // causing the parent to refetch and reset the trainer mid-session.
          setLocalMnemonic(mnemonic);
          setLocalWordGroup(wordGroup);
          setLocalSemanticGroup(semanticGroup);
          setIsEditingProps(false);
          queryClient.invalidateQueries({ queryKey: getGetWordQueryKey(current.id) });
        },
      }
    );
  };

  // Invalidate the full word list when the session ends so other screens are in sync.
  const invalidateListOnFinish = () => {
    queryClient.invalidateQueries({ queryKey: getListWordsQueryKey() });
  };

  const norm = (s: string) => s.trim().toLowerCase();

  /** Called when user finishes the last pass of the current word */
  const advanceWord = () => {
    setCompletedWords(c => c + 1);
    if (current?.id) recordTrace.mutate({ id: current.id });
    const nextWord = wordIndex + 1;
    if (nextWord >= words.length) {
      setFinished(true);
      invalidateListOnFinish();
      onFinish?.();
    } else {
      setWordIndex(nextWord);
    }
  };

  // Pass sequence: even pass = PL→DE→EN, odd pass = EN→DE→PL
  // Visual column order is ALWAYS PL | DE | EN — only focus direction changes
  const passSequence = current ? getRowFields(passIndex, current) : ([] as Field[]);
  const activeField  = passSequence[stepIndex] as Field | undefined;

  const fieldTarget = (f: Field) =>
    f === "pl" ? current?.polish : f === "de" ? current?.german : current?.english;

  const handleChange = (value: string) => {
    if (!current || !activeField || flash) return;
    setActiveInput(value);

    const target = fieldTarget(activeField);
    if (!target || norm(value) !== norm(target)) return;

    // Active field correct — confirm it
    const newConfirmed = { ...confirmed, [activeField]: target };
    const nextStep = stepIndex + 1;

    if (nextStep >= passSequence.length) {
      // All fields done → flash → advance pass or word
      setConfirmed(newConfirmed);
      setFlash(true);
      setTimeout(() => {
        setFlash(false);
        const nextPass = passIndex + 1;
        if (nextPass >= repetitions) {
          advanceWord();
        } else {
          // Next pass: hold = confirmed values of this pass, active = first field of next pass
          setHoldValues(newConfirmed);
          setConfirmed({ pl: "", de: "", en: "" });
          setPassIndex(nextPass);
          setStepIndex(0);
          setActiveInput("");
          focusFirstOnRender.current = true;
        }
      }, 400);
    } else {
      // Advance to next field in sequence — it will clear (drop from holdValues to active)
      setConfirmed(newConfirmed);
      setStepIndex(nextStep);
      setActiveInput("");
      pendingFocusId.current = `trace-input-${passSequence[nextStep]}`;
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

  // ── Empty / Finished ────────────────────────────────────────────────────

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
            setPassIndex(0);
            setStepIndex(0);
            setActiveInput("");
            setConfirmed({ pl: "", de: "", en: "" });
            setHoldValues({ pl: "", de: "", en: "" });
            setFlash(false);
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

  // Fractional progress: include partial progress within current word
  const progressPercent = ((completedWords + passIndex / repetitions) / words.length) * 100;
  const hasPl = !!current.polish;
  const haDe  = !!current.german;
  const hasEn = !!current.english;

  const translationLine = [current.polish, current.german, current.english]
    .filter(Boolean)
    .join(" · ");

  // ── Shared elements ─────────────────────────────────────────────────────

  const progressBar = <Progress value={progressPercent} className="h-1" />;

  const counter = (
    <div className="text-sm font-semibold bg-secondary/60 px-3 py-1.5 rounded-full flex items-center gap-1 text-primary shrink-0">
      <Check className="h-3.5 w-3.5" /> {completedWords}/{words.length}
    </div>
  );

  const referenceCard = (
    <div className="py-3 px-3 border rounded-xl bg-muted/30 space-y-1.5">
      <p className="font-bold font-serif text-2xl leading-tight">{current.russian}</p>
      <p className="text-sm text-muted-foreground whitespace-nowrap overflow-x-auto scrollbar-none">
        {translationLine}
      </p>

      {/* Property panel — inline editable (mnemonic + wordGroup + semanticGroup) */}
      <div className="group pt-0.5">
        {isEditingProps ? (
          <div className="space-y-3">
            {/* Mnemonic textarea */}
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Мнемоника</Label>
              <Textarea
                ref={mnemonicRef}
                value={mnemonicDraft}
                onChange={e => setMnemonicDraft(e.target.value)}
                placeholder="Напишите свою подсказку... (Enter = новая строка)"
                className="text-xs resize-none bg-background min-h-[52px]"
                rows={3}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={e => {
                  if (e.key === "Escape") setIsEditingProps(false);
                }}
              />
            </div>
            {/* Groups row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{MNEMONIC_GROUP.emoji} {MNEMONIC_GROUP.label}</Label>
                <GroupCombobox
                  value={wordGroupDraft}
                  onChange={setWordGroupDraft}
                  tags={mnemoGroupTags}
                  placeholder={MNEMONIC_GROUP.placeholder}
                  emoji={MNEMONIC_GROUP.emoji}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{SEMANTIC_GROUP.emoji} {SEMANTIC_GROUP.label}</Label>
                <GroupCombobox
                  value={semanticGroupDraft}
                  onChange={setSemanticGroupDraft}
                  tags={semanticGroupTags}
                  placeholder={SEMANTIC_GROUP.placeholder}
                  emoji={SEMANTIC_GROUP.emoji}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveProps} disabled={updateWord.isPending} className="h-7 text-xs">
                <Save className="h-3 w-3 mr-1" />
                {updateWord.isPending ? "Сохраняю..." : "Сохранить"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingProps(false)} className="h-7 text-xs">
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-start gap-1.5 cursor-pointer rounded-lg px-1 py-0.5 -mx-1 hover:bg-primary/10 transition-colors"
            onClick={handleStartEditProps}
            title="Нажмите чтобы редактировать"
          >
            <div className="flex-1 space-y-1 min-w-0">
              {displayMnemonic ? (
                <p className="text-xs text-primary/60 italic leading-relaxed whitespace-pre-wrap">"{displayMnemonic}"</p>
              ) : (
                <p className="text-xs text-muted-foreground/50">+ добавить мнемонику</p>
              )}
              {(displayWordGroup || displaySemanticGroup) && (
                <div className="flex gap-1.5 flex-wrap">
                  {displayWordGroup && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 leading-none">
                      {MNEMONIC_GROUP.emoji} {displayWordGroup}
                    </span>
                  )}
                  {displaySemanticGroup && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 leading-none">
                      {SEMANTIC_GROUP.emoji} {displaySemanticGroup}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Pencil className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary/50 shrink-0 mt-0.5 transition-colors" />
          </div>
        )}
      </div>
    </div>
  );

  // Visual column order is ALWAYS PL → DE → EN (never reorders).
  // Only the focus sequence changes per pass direction.
  const visualFields: Field[] = (["pl", "de", "en"] as Field[]).filter(f =>
    f === "pl" ? hasPl : f === "de" ? haDe : hasEn
  );

  // Which position in passSequence corresponds to each field
  const passStepOf = (f: Field) => passSequence.indexOf(f);

  // Pass-progress dots (shown only when repetitions > 1)
  const passDots = repetitions > 1 && (
    <div className="flex items-center gap-1.5 justify-center pt-1">
      {Array.from({ length: repetitions }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i < passIndex   ? "w-5 bg-green-400/70" :
            i === passIndex ? "w-5 bg-primary" : "w-2 bg-muted-foreground/25",
          )}
        />
      ))}
    </div>
  );

  const inputRows = (
    <div className="space-y-2">
      <div className={cn(
        "flex gap-3 w-full overflow-x-auto scrollbar-none",
        flash && "success-pulse",
      )}>
        {visualFields.map(f => {
          const step   = passStepOf(f);
          const isActive    = f === activeField && !flash;
          const isDoneInPass = step < stepIndex || flash; // confirmed in this pass
          const isHoldover  = !isActive && !isDoneInPass; // prev-pass value, not yet reached

          // What to display in the input
          const displayValue =
            isActive    ? activeInput :
            isDoneInPass ? confirmed[f] :
            holdValues[f]; // may be "" for first pass (shows hint)

          // Green style if confirmed in current pass OR holding a prev-pass answer
          const isDoneStyle = isDoneInPass || (isHoldover && holdValues[f] !== "");

          return (
            <FieldInput
              key={f}
              ref={isActive ? firstInputRef : undefined}
              id={`trace-input-${f}`}
              hint={f === "pl" ? (current.polish ?? "") : f === "de" ? (current.german ?? "") : (current.english ?? "")}
              value={displayValue}
              onChange={isActive ? v => handleChange(v) : () => {}}
              onFocus={handleInputFocus}
              done={isDoneStyle}
              lang={f}
            />
          );
        })}
      </div>
      {passDots}
    </div>
  );

  const skipButton = (
    <Button variant="ghost" size="sm" className="text-muted-foreground self-start mt-1" onClick={handleSkip}>
      Пропустить <ArrowRight className="ml-1 h-4 w-4" />
    </Button>
  );

  // ── Bridge input: always mounted, offscreen, keeps iOS keyboard alive ──
  const bridge = (
    <input
      ref={bridgeRef}
      aria-hidden="true"
      tabIndex={-1}
      readOnly
      style={{
        position: "fixed",
        left: "-9999px",
        top: "-9999px",
        width: "1px",
        height: "1px",
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );

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
            {inputRows}
            {skipButton}
          </div>
        </div>
      </div>
    );
  }

  // ── PORTRAIT: standard vertical ──────────────────────────────────────────
  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">
      {bridge}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{headerRight}</div>
        {counter}
      </div>
      {progressBar}
      {referenceCard}
      {inputRows}
      <Button variant="ghost" size="sm" className="text-muted-foreground self-center mt-1" onClick={handleSkip}>
        Пропустить <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
