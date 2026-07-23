import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGetStats, useGetSettings } from "@workspace/api-client-react";

export default function Home() {
  const { data: stats, isLoading } = useGetStats();
  const { data: settings } = useGetSettings();

  if (isLoading || !stats) return null;

  const accuracy = stats.accuracyPercent || 0;
  const masteredPct = stats.totalWords > 0
    ? (stats.masteredWords / stats.totalWords) * 100
    : 0;

  return (
    <div className="flex flex-col gap-16 pb-12 pt-4 animate-in fade-in duration-500">

      {/* ── Действия ── */}
      <div className="flex flex-col gap-10">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold font-serif">Прописи</p>
            {stats.dueForReview > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">{stats.dueForReview} на повторение</p>
            )}
          </div>
          <Link href="/trace">
            <Button size="lg">Начать</Button>
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold font-serif">Тест</p>
            {settings && (
              <p className="text-sm text-muted-foreground mt-0.5">
                сессия {(settings.totalSessions ?? 0) + 1}
              </p>
            )}
          </div>
          <Link href="/train">
            <Button size="lg" variant="outline" data-testid="button-start-training">Начать</Button>
          </Link>
        </div>

      </div>

      {/* ── Статистика ── */}
      <div className="flex flex-col gap-6">

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">сегодня</span>
          <span className="font-bold">{stats.wordsLearnedToday}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">слов в словаре</span>
          <span className="font-bold">{stats.totalWords}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">точность</span>
          <span className="font-bold">
            {accuracy >= 10 ? Math.round(accuracy) : accuracy.toFixed(1)}%
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground text-sm">освоено</span>
            <span className="font-bold">
              {stats.masteredWords}
              <span className="text-muted-foreground font-normal"> / {stats.totalWords}</span>
            </span>
          </div>
          {stats.totalWords > 0 && (
            <Progress value={masteredPct} className="h-0.5" />
          )}
        </div>

      </div>

    </div>
  );
}
