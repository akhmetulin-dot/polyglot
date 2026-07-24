import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGetStats, useGetSettings, useListWords } from "@workspace/api-client-react";
import { MNEMONIC_GROUP, SEMANTIC_GROUP } from "@/lib/field-meta";

const TYPE_LABELS: Record<string, string> = {
  academic:  "Академические",
  everyday:  "Базовые",
  mixed:     "Смешанные",
  __none__:  "Без типа",
};

export default function Home() {
  const { data: stats, isLoading } = useGetStats();
  const { data: settings } = useGetSettings();
  const { data: wordsData } = useListWords({ limit: 1000 });

  if (isLoading || !stats) return null;

  const accuracy = stats.accuracyPercent || 0;
  const masteredPct = stats.totalWords > 0
    ? (stats.masteredWords / stats.totalWords) * 100
    : 0;

  // ── Breakdown by wordType ────────────────────────────────────────────────────
  const words = wordsData?.words ?? [];
  const typeCounts = words.reduce<Record<string, number>>((acc, w) => {
    const key = w.wordType || "__none__";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const typeOrder = ["academic", "everyday", "mixed", "__none__"];
  const typeRows = typeOrder
    .filter(k => typeCounts[k])
    .map(k => ({ key: k, label: TYPE_LABELS[k], count: typeCounts[k] }));

  // ── "Не заполнено" по полям ─────────────────────────────────────────────────
  const total = stats.totalWords;
  const noMnemonic      = words.filter(w => !w.mnemonic).length;
  const noTranslation   = words.filter(w => !w.polish && !w.german && !w.english).length;
  const noType          = words.filter(w => !w.wordType).length;
  const noMnemoGroup    = words.filter(w => !w.wordGroup).length;
  const noSemanticGroup = words.filter(w => !w.semanticGroup).length;

  const gapRows = [
    { label: "без мнемоники",     count: noMnemonic },
    { label: "без перевода",       count: noTranslation },
    { label: "без типа",           count: noType },
    { label: "без мнемо-группы",   count: noMnemoGroup },
    { label: "без смысл-группы",   count: noSemanticGroup },
  ].filter(r => r.count > 0);

  // ── Breakdown by wordGroup (мнемонические) ──────────────────────────────────
  const mnemoGroupCounts = words.reduce<Record<string, number>>((acc, w) => {
    if (!w.wordGroup) return acc;
    acc[w.wordGroup] = (acc[w.wordGroup] ?? 0) + 1;
    return acc;
  }, {});
  const mnemoGroupRows = Object.entries(mnemoGroupCounts).sort(([, a], [, b]) => b - a);

  // ── Breakdown by semanticGroup (смысловые) ───────────────────────────────────
  const semanticGroupCounts = words.reduce<Record<string, number>>((acc, w) => {
    if (!w.semanticGroup) return acc;
    acc[w.semanticGroup] = (acc[w.semanticGroup] ?? 0) + 1;
    return acc;
  }, {});
  const semanticGroupRows = Object.entries(semanticGroupCounts).sort(([, a], [, b]) => b - a);

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

      {/* ── Общая статистика ── */}
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

      {/* ── Не заполнено ── */}
      {total > 0 && gapRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Не заполнено</p>
          <div className="flex flex-col gap-3">
            {gapRows.map(({ label, count }) => (
              <div key={label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-bold tabular-nums text-destructive/70">{count} <span className="text-muted-foreground font-normal">/ {total}</span></span>
                </div>
                <Progress value={((total - count) / total) * 100} className="h-0.5 [&>div]:bg-destructive/40" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── По типу слова ── */}
      {typeRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">По типу</p>
          <div className="flex flex-col gap-3">
            {typeRows.map(({ key, label, count }) => (
              <div key={key}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-bold tabular-nums">{count}</span>
                </div>
                <Progress value={(count / stats.totalWords) * 100} className="h-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── По мнемоническим группам ── */}
      {mnemoGroupRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{MNEMONIC_GROUP.emoji} {MNEMONIC_GROUP.labelPlural}</p>
          <div className="flex flex-col gap-3">
            {mnemoGroupRows.map(([group, count]) => (
              <div key={group}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{group}</span>
                  <span className="text-sm font-bold tabular-nums">{count}</span>
                </div>
                <Progress value={(count / stats.totalWords) * 100} className="h-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── По смысловым группам ── */}
      {semanticGroupRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{SEMANTIC_GROUP.emoji} {SEMANTIC_GROUP.labelPlural}</p>
          <div className="flex flex-col gap-3">
            {semanticGroupRows.map(([group, count]) => (
              <div key={group}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{group}</span>
                  <span className="text-sm font-bold tabular-nums">{count}</span>
                </div>
                <Progress value={(count / stats.totalWords) * 100} className="h-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
