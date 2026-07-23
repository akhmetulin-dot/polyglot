import { useState } from "react";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Minimal slider row ────────────────────────────────────────────────────────
function SliderRow({
  label,
  value,
  min = 1,
  max = 50,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">{value}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [local, setLocal] = useState<{
    errorRepeatAfter: number;
    sessionSize: number;
    reviewSessionSize: number;
    traceSessionSize: number;
    reviewIntervals: string;
    traceNew: number;
    traceReview: number;
    traceError: number;
    traceErrorReview: number;
    appName: string;
  } | null>(null);

  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconFile, setIconFile]       = useState<File | null>(null);

  if (settings && !local && !isLoading) {
    setLocal({
      errorRepeatAfter:  settings.errorRepeatAfter,
      sessionSize:       settings.sessionSize,
      reviewSessionSize: settings.reviewSessionSize,
      traceSessionSize:  settings.traceSessionSize,
      reviewIntervals:   settings.reviewIntervals.join(", "),
      traceNew:          settings.traceNew,
      traceReview:       settings.traceReview,
      traceError:        settings.traceError,
      traceErrorReview:  settings.traceErrorReview,
      appName:           settings.appName,
    });
  }

  const set = (patch: Partial<typeof local>) =>
    setLocal(prev => prev ? { ...prev, ...patch } : prev);

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    const reader = new FileReader();
    reader.onload = ev => setIconPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleIconUpload = async () => {
    if (!iconFile || !iconPreview) return;
    try {
      const res = await fetch("/api/app-icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: iconPreview }),
      });
      if (res.ok) {
        toast({ title: "Иконка загружена" });
        setIconFile(null);
      } else {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Ошибка", description: body?.error ?? `HTTP ${res.status}`, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Ошибка", description: String(e), variant: "destructive" });
    }
  };

  const handleSave = () => {
    if (!local) return;
    let intervals: number[];
    try {
      intervals = local.reviewIntervals.split(",").map(s => {
        const v = parseInt(s.trim(), 10);
        if (isNaN(v)) throw new Error();
        return v;
      });
    } catch {
      toast({ title: "Ошибка", description: "Интервалы — числа через запятую", variant: "destructive" });
      return;
    }
    updateSettings.mutate({
      data: {
        errorRepeatAfter:  local.errorRepeatAfter,
        sessionSize:       local.sessionSize,
        reviewSessionSize: local.reviewSessionSize,
        traceSessionSize:  local.traceSessionSize,
        reviewIntervals:   intervals,
        traceNew:          local.traceNew,
        traceReview:       local.traceReview,
        traceError:        local.traceError,
        traceErrorReview:  local.traceErrorReview,
        appName:           local.appName || "Полиглот",
      },
    }, {
      onSuccess: data => {
        queryClient.setQueryData(getGetSettingsQueryKey(), data);
        toast({ title: "Сохранено" });
      },
    });
  };

  if (isLoading || !local) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 max-w-xl mx-auto pt-4 pb-32 animate-in fade-in duration-500">

      {/* Название */}
      <div className="flex flex-col gap-3">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Приложение</span>
        <Input
          value={local.appName}
          onChange={e => set({ appName: e.target.value })}
          placeholder="Полиглот"
          maxLength={40}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="bg-transparent border-0 border-b rounded-none px-0 text-lg font-semibold focus-visible:ring-0 focus-visible:border-primary"
          onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300)}
        />
      </div>

      {/* Иконка */}
      <div className="flex flex-col gap-3">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Иконка</span>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center shrink-0">
            {iconPreview
              ? <img src={iconPreview} alt="preview" className="h-full w-full object-cover" />
              : <Upload className="h-5 w-5 text-muted-foreground/40" />
            }
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Выбрать
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleIconSelect} />
            </label>
            {iconFile && (
              <button onClick={handleIconUpload} className="text-sm text-primary hover:opacity-70 transition-opacity text-left">
                Загрузить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Прописи */}
      <div className="flex flex-col gap-8">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Прописи</span>
        <SliderRow label="слов за сессию"     value={local.traceSessionSize}  min={1} max={50} onChange={v => set({ traceSessionSize: v })} />
        <SliderRow label="повторений — новые" value={local.traceNew}          min={1} max={20} onChange={v => set({ traceNew: v })} />
        <SliderRow label="повторений — SRS"   value={local.traceReview}       min={1} max={20} onChange={v => set({ traceReview: v })} />
        <SliderRow label="повторений — ошибка в тесте"    value={local.traceError}      min={1} max={20} onChange={v => set({ traceError: v })} />
        <SliderRow label="повторений — ошибка в SRS"      value={local.traceErrorReview} min={1} max={20} onChange={v => set({ traceErrorReview: v })} />
      </div>

      {/* Тест */}
      <div className="flex flex-col gap-8">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Тест</span>
        <SliderRow label="слов за сессию"    value={local.sessionSize}      min={1} max={50} onChange={v => set({ sessionSize: v })} />
        <SliderRow label="повтор ошибок через" value={local.errorRepeatAfter} min={1} max={20} onChange={v => set({ errorRepeatAfter: v })} />
      </div>

      {/* Повторение */}
      <div className="flex flex-col gap-8">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Повторение</span>
        <SliderRow label="слов за сессию" value={local.reviewSessionSize} min={1} max={50} onChange={v => set({ reviewSessionSize: v })} />
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">интервалы (сессии)</span>
            <span className="font-mono text-xs text-muted-foreground">{local.reviewIntervals}</span>
          </div>
          <Input
            value={local.reviewIntervals}
            onChange={e => set({ reviewIntervals: e.target.value })}
            className="font-mono text-sm bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            placeholder="3, 5, 9, 13"
          />
        </div>
      </div>

      {/* Сохранить */}
      <div className="fixed bottom-0 left-0 right-0 flex gap-3 px-4 py-4 bg-background/95 backdrop-blur-sm border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setLocal({
            errorRepeatAfter: 5, sessionSize: 20, reviewSessionSize: 20,
            traceSessionSize: 10, reviewIntervals: "3, 5, 9, 13",
            traceNew: 3, traceReview: 2, traceError: 5, traceErrorReview: 5,
            appName: local.appName,
          })}
          disabled={updateSettings.isPending}
        >
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
          Сброс
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : "Сохранить"}
        </Button>
      </div>

    </div>
  );
}
