import { useState, useMemo } from "react";
import { useListWords, useGetSettings } from "@workspace/api-client-react";
import { TraceTrainer } from "@/components/trace-trainer";
import { Button } from "@/components/ui/button";
import { Loader2, Shuffle, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Word } from "@workspace/api-client-react";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Category = "new" | "review" | "all";

const CATEGORY_LABELS: Record<Category, string> = {
  new: "Новые",
  review: "Повторения",
  all: "Все",
};

const EMPTY_MSGS: Record<Category, string> = {
  new: "Новых слов нет — все уже в очереди повторения.",
  review: "Слов для повторения нет прямо сейчас.",
  all: "Нет слов с переводами для прописей.",
};

export default function Trace() {
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: wordsData, isLoading: wordsLoading } = useListWords({ limit: 500 });
  const [sessionKey, setSessionKey] = useState(0);
  const [category, setCategory] = useState<Category>("all");

  const totalSessions = settings?.totalSessions ?? 0;

  const countFor = (cat: Category): number => {
    const all: Word[] = (wordsData?.words ?? []).filter(w => w.polish || w.german || w.english);
    if (cat === "new") return all.filter(w => !w.nextReviewAt).length;
    if (cat === "review") return all.filter(w => w.nextReviewSession != null && w.nextReviewSession <= totalSessions).length;
    return all.length;
  };

  const categoryWords = useMemo<Word[]>(() => {
    const all: Word[] = (wordsData?.words ?? []).filter(w => w.polish || w.german || w.english);
    if (category === "new") return all.filter(w => !w.nextReviewAt);
    if (category === "review") return all.filter(w => w.nextReviewSession != null && w.nextReviewSession <= totalSessions);
    return all;
  }, [wordsData, category, totalSessions]);

  const sessionSize = settings?.sessionSize ?? 20;
  const repetitions =
    category === "new" ? (settings?.traceNew ?? 3) :
    category === "review" ? (settings?.traceReview ?? 2) :
    (settings?.traceNew ?? 3);

  const sessionWords = useMemo(
    () => shuffleArray(categoryWords).slice(0, sessionSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoryWords, sessionSize, sessionKey]
  );

  if (settingsLoading || wordsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const categoryPills = (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-full">
        {(["new", "review", "all"] as Category[]).map(cat => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setSessionKey(k => k + 1); }}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-full transition-colors",
              category === cat
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {CATEGORY_LABELS[cat]}
            <span className="ml-1 opacity-60 text-[10px]">{countFor(cat)}</span>
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-8 w-8 p-0"
        title="Перемешать"
        onClick={() => setSessionKey(k => k + 1)}
      >
        <Shuffle className="h-4 w-4" />
      </Button>
    </div>
  );

  if (sessionWords.length === 0) {
    return (
      <div className="space-y-6 pb-8 animate-in fade-in duration-500">
        {/* Keep header with category pills so user can switch */}
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-serif text-muted-foreground">Прописи</h1>
          {categoryPills}
        </div>
        <div className="max-w-xl mx-auto flex flex-col items-center justify-center py-16 text-center space-y-4">
          <PenLine className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">{EMPTY_MSGS[category]}</p>
          {category !== "all" && (
            <button
              className="text-sm text-primary underline underline-offset-2"
              onClick={() => { setCategory("all"); setSessionKey(k => k + 1); }}
            >
              Перейти к «Все»
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <TraceTrainer
        key={`${category}-${sessionKey}`}
        words={sessionWords}
        repetitions={repetitions}
        title="Прописи"
        headerRight={categoryPills}
      />
    </div>
  );
}
