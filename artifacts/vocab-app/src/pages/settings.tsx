import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetSettings, 
  useUpdateSettings, 
  getGetSettingsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, RefreshCcw, BookA, PenLine, PlayCircle, RotateCcw, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [localSettings, setLocalSettings] = useState<{
    errorRepeatAfter: number;
    sessionSize: number;
    reviewSessionSize: number;
    traceSessionSize: number;
    reviewIntervals: string;
    traceNew: number;
    traceReview: number;
    traceError: number;
    traceErrorReview: number;
  } | null>(null);

  // Initialize local settings once
  if (settings && !localSettings && !isLoading) {
    setLocalSettings({
      errorRepeatAfter: settings.errorRepeatAfter,
      sessionSize: settings.sessionSize,
      reviewSessionSize: settings.reviewSessionSize,
      traceSessionSize: settings.traceSessionSize,
      reviewIntervals: settings.reviewIntervals.join(", "),
      traceNew: settings.traceNew,
      traceReview: settings.traceReview,
      traceError: settings.traceError,
      traceErrorReview: settings.traceErrorReview,
    });
  }

  const handleSave = () => {
    if (!localSettings) return;

    let intervals: number[];
    try {
      intervals = localSettings.reviewIntervals.split(",").map(s => {
        const val = parseInt(s.trim(), 10);
        if (isNaN(val)) throw new Error("Invalid interval");
        return val;
      });
    } catch {
      toast({
        title: "Ошибка",
        description: "Интервалы должны быть числами, разделёнными запятыми.",
        variant: "destructive",
      });
      return;
    }

    updateSettings.mutate({
      data: {
        errorRepeatAfter: localSettings.errorRepeatAfter,
        sessionSize: localSettings.sessionSize,
        reviewSessionSize: localSettings.reviewSessionSize,
        traceSessionSize: localSettings.traceSessionSize,
        reviewIntervals: intervals,
        traceNew: localSettings.traceNew,
        traceReview: localSettings.traceReview,
        traceError: localSettings.traceError,
        traceErrorReview: localSettings.traceErrorReview,
      }
    }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetSettingsQueryKey(), data);
        toast({
          title: "Сохранено",
          description: "Настройки успешно обновлены.",
        });
      }
    });
  };

  if (isLoading || !localSettings) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-500">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold font-serif text-foreground">Настройки</h1>
        <p className="text-muted-foreground">Настройка алгоритма изучения и интервального повторения.</p>
      </header>

      {/* Flow diagram */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
          <PenLine className="h-3.5 w-3.5" />
          Прописи
        </div>
        <ArrowRight className="h-3.5 w-3.5" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
          <PlayCircle className="h-3.5 w-3.5" />
          Тест
        </div>
        <ArrowRight className="h-3.5 w-3.5" />
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
          <RotateCcw className="h-3.5 w-3.5" />
          Повторение
        </div>
      </div>

      {/* Прописи */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-blue-500" />
            Прописи — первое знакомство
          </CardTitle>
          <CardDescription>
            Новые слова: видишь слово первый раз и пишешь его несколько раз, чтобы запомнить.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base">Слов в Прописях</Label>
              <span className="font-bold text-lg text-blue-500">{localSettings.traceSessionSize}</span>
            </div>
            <Slider
              min={5} max={50} step={1}
              value={[localSettings.traceSessionSize]}
              onValueChange={([val]) => setLocalSettings({ ...localSettings, traceSessionSize: val })}
            />
            <p className="text-xs text-muted-foreground">Сколько новых слов берётся за одну сессию Прописей.</p>
          </div>

          <div className="space-y-3 border-t pt-6">
            <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Повторений за каждое слово</Label>
            {(
              [
                { key: "traceNew" as const, label: "Новые слова", hint: "Первый раз встречается — пишется больше раз для лучшего запоминания" },
                { key: "traceReview" as const, label: "Слова из Повторения", hint: "Слова из очереди SRS — уже частично знакомы, меньше повторений" },
                { key: "traceError" as const, label: "После ошибки в Тесте", hint: "Слово не прошло Тест и вернулось в Прописи" },
                { key: "traceErrorReview" as const, label: "Ошибка в Повторении", hint: "Ошибка в слове из очереди Повторения — требует тщательного повторения" },
              ] as const
            ).map(({ key, label, hint }) => (
              <div key={key} className="space-y-3 py-2">
                <div className="flex justify-between items-center">
                  <Label className="text-base">{label}</Label>
                  <span className="font-bold text-lg text-blue-500">{localSettings[key]}</span>
                </div>
                <Slider
                  min={1} max={20} step={1}
                  value={[localSettings[key]]}
                  onValueChange={([val]) => setLocalSettings({ ...localSettings, [key]: val })}
                />
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Тест */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-primary" />
            Тест — проверка памяти
          </CardTitle>
          <CardDescription>
            После Прописей слова идут на Тест: нужно ввести перевод без подсказок.
            Правильный ответ → слово попадает в Повторение. Ошибка → слово возвращается в Прописи первым.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base">Слов в Тесте</Label>
              <span className="font-bold text-lg text-primary">{localSettings.sessionSize}</span>
            </div>
            <Slider 
              min={5} max={50} step={1}
              value={[localSettings.sessionSize]} 
              onValueChange={([val]) => setLocalSettings({ ...localSettings, sessionSize: val })} 
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base">Повтор ошибок через N слов</Label>
              <span className="font-bold text-lg text-primary">{localSettings.errorRepeatAfter}</span>
            </div>
            <Slider 
              min={1} max={20} step={1}
              value={[localSettings.errorRepeatAfter]} 
              onValueChange={([val]) => setLocalSettings({ ...localSettings, errorRepeatAfter: val })} 
            />
            <p className="text-xs text-muted-foreground">Если в Тесте ошиблись, слово снова появится в этой же сессии через N шагов.</p>
          </div>
        </CardContent>
      </Card>

      {/* Повторение + SRS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-green-600 dark:text-green-400" />
            Повторение — интервальное SRS
          </CardTitle>
          <CardDescription>
            Изученные слова возвращаются через заданные интервалы сессий. Чем чаще правильно — тем реже появляется слово.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base">Слов в Повторении</Label>
              <span className="font-bold text-lg text-green-600 dark:text-green-400">{localSettings.reviewSessionSize}</span>
            </div>
            <Slider 
              min={5} max={50} step={1}
              value={[localSettings.reviewSessionSize]} 
              onValueChange={([val]) => setLocalSettings({ ...localSettings, reviewSessionSize: val })} 
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Интервалы между сессиями</Label>
              <Badge variant="secondary" className="font-mono text-xs">
                {localSettings.reviewIntervals}
              </Badge>
            </div>
            <Input 
              value={localSettings.reviewIntervals}
              onChange={(e) => setLocalSettings({ ...localSettings, reviewIntervals: e.target.value })}
              className="font-mono text-sm bg-muted/50"
              placeholder="3, 5, 9, 13"
            />
            <p className="text-xs text-muted-foreground">
              Через сколько <span className="font-semibold">сессий Теста</span> слово появится на Повторении.
              Пример: 3, 5, 9, 13 — сначала через 3 сессии, потом через 5, потом через 9 и т.д.
              Чем больше чисел — тем дольше слово будет в обороте.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setLocalSettings({
            errorRepeatAfter: 5,
            sessionSize: 20,
            reviewSessionSize: 20,
            traceSessionSize: 10,
            reviewIntervals: "3, 5, 9, 13",
            traceNew: 3,
            traceReview: 2,
            traceError: 5,
            traceErrorReview: 5,
          })}
          disabled={updateSettings.isPending}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Сбросить
        </Button>
        <Button 
          size="lg" 
          className="flex-[2]" 
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Сохранить настройки
        </Button>
      </div>
    </div>
  );
}
