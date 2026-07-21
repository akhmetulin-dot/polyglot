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
import { Loader2, Save, RefreshCcw, BookA, PenLine } from "lucide-react";
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
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold font-serif text-foreground">Настройки</h1>
        <p className="text-muted-foreground">Управление алгоритмом интервального повторения.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            Интервальное повторение
          </CardTitle>
          <CardDescription>
            Настройка алгоритма запоминания слов.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
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
            <p className="text-xs text-muted-foreground">Если вы ошиблись, слово снова появится в сессии через это количество шагов.</p>
          </div>

          <div className="space-y-3">
            <Label className="text-base">Интервалы повторения (в сессиях)</Label>
            <Input 
              value={localSettings.reviewIntervals}
              onChange={(e) => setLocalSettings({ ...localSettings, reviewIntervals: e.target.value })}
              className="font-mono text-sm bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">Через сколько сессий слово появится на повторении. Пример: 3, 5, 9, 13</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookA className="h-5 w-5 text-primary" />
            Сессии
          </CardTitle>
          <CardDescription>
            Количество слов в каждой сессии.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-base">Слов в тренировке</Label>
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
              <Label className="text-base">Слов в повторении</Label>
              <span className="font-bold text-lg text-primary">{localSettings.reviewSessionSize}</span>
            </div>
            <Slider 
              min={5} max={50} step={1}
              value={[localSettings.reviewSessionSize]} 
              onValueChange={([val]) => setLocalSettings({ ...localSettings, reviewSessionSize: val })} 
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            Прописи — повторений за слово
          </CardTitle>
          <CardDescription>
            Сколько раз вводить каждое слово в режиме <Link href="/trace" className="text-primary underline-offset-2 hover:underline">«Прописи»</Link> в зависимости от категории.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(
            [
              { key: "traceNew" as const, label: "Новые слова", hint: "Первый раз встречается — обведите больше раз" },
              { key: "traceReview" as const, label: "Повторения SRS", hint: "Слова из очереди повторения — уже частично знакомы" },
              { key: "traceError" as const, label: "Слова с ошибками", hint: "После неверного ответа в тренажёре" },
              { key: "traceErrorReview" as const, label: "Ошибки-повторения", hint: "Ошибка в слове, которое было на повторении" },
            ] as const
          ).map(({ key, label, hint }) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base">{label}</Label>
                <span className="font-bold text-lg text-primary">{localSettings[key]}</span>
              </div>
              <Slider
                min={1} max={20} step={1}
                value={[localSettings[key]]}
                onValueChange={([val]) => setLocalSettings({ ...localSettings, [key]: val })}
              />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
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
            reviewIntervals: "3, 5, 9, 13",
            traceNew: 3,
            traceReview: 2,
            traceError: 5,
            traceErrorReview: 5,
          })}
          disabled={updateSettings.isPending}
        >
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
