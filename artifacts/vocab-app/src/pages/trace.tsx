import { useListWords, useGetSettings } from "@workspace/api-client-react";
import { TraceTrainer } from "@/components/trace-trainer";
import { Loader2 } from "lucide-react";

export default function Trace() {
  const { data: settings, isLoading: settingsLoading } = useGetSettings();
  const { data: wordsData, isLoading: wordsLoading } = useListWords({ limit: 50 });

  if (settingsLoading || wordsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const words = (wordsData?.words ?? []).filter(w => w.polish || w.german || w.english);
  const repetitions = settings?.traceNew ?? 3;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500">
      <TraceTrainer
        words={words}
        repetitions={repetitions}
        title="Прописи"
      />
    </div>
  );
}
