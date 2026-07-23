import { useMemo, useState } from "react";
import { useListWords, useGetSettings } from "@workspace/api-client-react";
import { TraceTrainer } from "@/components/trace-trainer";
import { Loader2, PenLine } from "lucide-react";
import type { Word } from "@workspace/api-client-react";

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Trace() {
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: wordsData,  isLoading: wordsLoading  } = useListWords({ limit: 500 });
  const [sessionKey, setSessionKey] = useState(0);

  const totalSessions = settings?.totalSessions ?? 0;

  // Auto-pick category: new words first, fall back to due reviews, then everything
  const { words: categoryWords, repetitions } = useMemo<{
    words: Word[];
    repetitions: number;
  }>(() => {
    const all = (wordsData?.words ?? []).filter(w => w.polish || w.german || w.english);
    const newWords    = all.filter(w => !w.nextReviewAt);
    const reviewWords = all.filter(w => w.nextReviewSession != null && w.nextReviewSession <= totalSessions);

    if (newWords.length > 0)    return { words: newWords,    repetitions: settings?.traceNew    ?? 3 };
    if (reviewWords.length > 0) return { words: reviewWords, repetitions: settings?.traceReview ?? 2 };
    return                             { words: all,          repetitions: settings?.traceNew    ?? 3 };
  }, [wordsData, totalSessions, settings, sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionSize  = settings?.traceSessionSize ?? 10;
  const sessionWords = useMemo(
    () => shuffleArray(categoryWords).slice(0, sessionSize),
    [categoryWords, sessionSize, sessionKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (settingsLoading || wordsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessionWords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
        <PenLine className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Нет слов для прописей</p>
      </div>
    );
  }

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      <TraceTrainer
        key={`session-${sessionKey}`}
        words={sessionWords}
        repetitions={repetitions}
        onFinish={() => setSessionKey(k => k + 1)}
      />
    </div>
  );
}
