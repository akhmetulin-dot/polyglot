import { useMemo, useState } from "react";
import { useListWords, useGetSettings } from "@workspace/api-client-react";
import { TraceTrainer } from "@/components/trace-trainer";
import { Loader2, PenLine, Shuffle, ArrowUpNarrowWide, Sparkles, BookOpen } from "lucide-react";
import type { Word } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Small pill toggle used in the control bar */
function Pill({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export default function Trace() {
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: wordsData,  isLoading: wordsLoading  } = useListWords({ limit: 500 });
  const [sessionKey, setSessionKey] = useState(0);

  // ── Session mode controls ────────────────────────────────────────────────────
  /** How to order words: shuffle (default) or ascending by traceCount */
  const [sortMode, setSortMode] = useState<"shuffle" | "trace_asc">("shuffle");
  /** Whether to exclude words never traced (traceCount === 0) */
  const [tracedOnly, setTracedOnly] = useState(false);

  const totalSessions = settings?.totalSessions ?? 0;

  // ── Word selection ───────────────────────────────────────────────────────────
  const { words: categoryWords, repetitions } = useMemo<{
    words: Word[];
    repetitions: number;
  }>(() => {
    const all = (wordsData?.words ?? []).filter(w => w.polish || w.german || w.english);

    if (sortMode === "trace_asc") {
      // Reinforce mode: sort by traceCount ASC (untraced first, then least-practiced)
      // Optionally skip completely untraced words
      const pool = tracedOnly ? all.filter(w => (w.traceCount ?? 0) > 0) : all;
      const sorted = [...pool].sort((a, b) => (a.traceCount ?? 0) - (b.traceCount ?? 0));
      return { words: sorted, repetitions: settings?.traceNew ?? 3 };
    }

    // Default algorithm: new words first, fall back to SRS reviews, then everything
    const pool = tracedOnly ? all.filter(w => (w.traceCount ?? 0) > 0) : all;
    const newWords    = pool.filter(w => !w.nextReviewAt);
    const reviewWords = pool.filter(w => w.nextReviewSession != null && w.nextReviewSession <= totalSessions);

    if (newWords.length > 0)    return { words: newWords,    repetitions: settings?.traceNew    ?? 3 };
    if (reviewWords.length > 0) return { words: reviewWords, repetitions: settings?.traceReview ?? 2 };
    return                             { words: pool,         repetitions: settings?.traceNew    ?? 3 };
  }, [wordsData, totalSessions, settings, sessionKey, sortMode, tracedOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionSize  = settings?.traceSessionSize ?? 10;
  const sessionWords = useMemo(() => {
    if (sortMode === "trace_asc") {
      // Already sorted — just take the first N (least practiced)
      return categoryWords.slice(0, sessionSize);
    }
    return shuffleArray(categoryWords).slice(0, sessionSize);
  }, [categoryWords, sessionSize, sessionKey, sortMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (settingsLoading || wordsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      {/* ── Mode control bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2">
        {/* Sort mode */}
        <Pill
          active={sortMode === "shuffle"}
          onClick={() => { setSortMode("shuffle"); setSessionKey(k => k + 1); }}
          icon={<Shuffle className="h-3 w-3" />}
          label="Вперемешку"
        />
        <Pill
          active={sortMode === "trace_asc"}
          onClick={() => { setSortMode("trace_asc"); setSessionKey(k => k + 1); }}
          icon={<ArrowUpNarrowWide className="h-3 w-3" />}
          label="От меньше прописанных"
        />

        {/* Separator */}
        <span className="w-px bg-border self-stretch mx-0.5" />

        {/* Filter: include new (never traced) or skip them */}
        <Pill
          active={!tracedOnly}
          onClick={() => { setTracedOnly(false); setSessionKey(k => k + 1); }}
          icon={<Sparkles className="h-3 w-3" />}
          label="Все слова"
        />
        <Pill
          active={tracedOnly}
          onClick={() => { setTracedOnly(true); setSessionKey(k => k + 1); }}
          icon={<BookOpen className="h-3 w-3" />}
          label="Только прописанные"
        />
      </div>

      {/* ── Info line ────────────────────────────────────────────────────────── */}
      {sessionWords.length > 0 && (
        <p className="text-[11px] text-muted-foreground px-4 pb-1">
          {sortMode === "trace_asc"
            ? `${sessionWords.length} сл. · мин. прописей: ${sessionWords[0]?.traceCount ?? 0}`
            : `${sessionWords.length} сл. · случайный порядок`}
          {tracedOnly && " · только прописанные"}
        </p>
      )}

      {sessionWords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <PenLine className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {tracedOnly
              ? "Нет слов которые уже прописывались. Попробуйте режим «Все слова»."
              : "Нет слов для прописей"}
          </p>
        </div>
      ) : (
        <TraceTrainer
          key={`session-${sessionKey}`}
          words={sessionWords}
          repetitions={repetitions}
          onFinish={() => setSessionKey(k => k + 1)}
        />
      )}
    </div>
  );
}
