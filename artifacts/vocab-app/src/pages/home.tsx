import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, Play, CheckCircle2, Trophy, Clock, Target, BookOpen, PenLine } from "lucide-react";
import { useGetStats, useGetSettings } from "@workspace/api-client-react";

export default function Home() {
  const { data: stats, isLoading } = useGetStats();
  const { data: settings } = useGetSettings();

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-32 bg-muted rounded-xl"></div>
          <div className="h-32 bg-muted rounded-xl"></div>
        </div>
        <div className="h-64 bg-muted rounded-xl"></div>
      </div>
    );
  }

  const accuracy = stats.accuracyPercent || 0;

  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-500">

      <div className="grid gap-4 sm:grid-cols-2">

        {/* ── Прописи — первое знакомство с новыми словами ── */}
        <Card className="border-primary/20 shadow-sm relative overflow-hidden bg-primary text-primary-foreground sm:col-span-2">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-4 -translate-y-4">
            <PenLine className="w-32 h-32" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-primary-foreground/90 font-sans text-sm font-medium flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Прописи
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-2xl font-bold font-serif">Изучить новые слова</div>
              <p className="text-primary-foreground/60 text-sm">Впервые видите слово — пишете и запоминаете</p>
              {stats && stats.totalWords > 0 && (
                <p className="text-primary-foreground/40 text-xs">{stats.totalWords} слов в словаре</p>
              )}
            </div>
            <Link href="/trace" className="shrink-0">
              <Button size="lg" className="bg-background text-foreground hover:bg-background/90">Начать</Button>
            </Link>
          </CardContent>
        </Card>

        {/* ── Тест — проверить что запомнил ── */}
        <Card className="border-border shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 pointer-events-none translate-x-4 -translate-y-4">
            <Brain className="w-24 h-24" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <Play className="h-4 w-4" />
              Тест
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold font-serif">Проверить себя</div>
            {settings && (
              <p className="text-muted-foreground text-xs">
                Сессия #{(settings.totalSessions ?? 0) + 1} · до {settings.sessionSize} слов
              </p>
            )}
            <Link href="/train" className="w-full">
              <Button variant="outline" size="lg" className="w-full" data-testid="button-start-training">
                Начать тест
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* ── Повторение — SRS ── */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Повторение
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-serif">{stats.dueForReview}</span>
              <span className="text-muted-foreground text-sm">слов ждёт</span>
            </div>
            <Link href="/review" className="w-full">
              <Button variant="outline" size="lg" className="w-full" disabled={stats.dueForReview === 0} data-testid="button-start-review">
                {stats.dueForReview > 0 ? "Повторить" : "Всё повторено!"}
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-serif">Статистика</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg text-primary">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Верно сегодня</p>
                <p className="text-xl font-bold">{stats.wordsLearnedToday}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-secondary rounded-lg text-foreground">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего слов</p>
                <p className="text-xl font-bold">{stats.totalWords}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-[#4ade80]/20 rounded-lg text-[#166534]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Точность</p>
                <p className="text-xl font-bold">{accuracy >= 10 ? Math.round(accuracy) : accuracy.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground/50">за всё время</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-[#f59e0b]/20 rounded-lg text-[#92400e]">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Мастерство</p>
                <p className="text-xl font-bold">{stats.masteredWords} <span className="text-sm font-normal text-muted-foreground">/ {stats.totalWords}</span></p>
                {stats.totalWords > 0 && (
                  <Progress value={(stats.masteredWords / stats.totalWords) * 100} className="h-1 mt-1 w-20" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
